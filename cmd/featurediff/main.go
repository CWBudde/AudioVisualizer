// featurediff compares two features.json files value by value and fails on
// any difference outside the allowed paths.
package main

import (
	"encoding/json"
	"flag"
	"fmt"
	"math"
	"os"
	"regexp"
	"slices"
	"strings"
)

type diff struct {
	path, detail string
}

var index = regexp.MustCompile(`\[\d+\]`)

func main() {
	allow := flag.String("allow", "tracks.*.spectrogramDB,spectrogramBinHz,provenance.*", "comma-separated paths allowed to differ; * matches one segment")
	flag.Parse()
	if flag.NArg() != 2 {
		fmt.Fprintln(os.Stderr, "usage: featurediff [-allow paths] before.json after.json")
		os.Exit(2)
	}
	var docs [2]any
	for i := range docs {
		data, err := os.ReadFile(flag.Arg(i))
		if err == nil {
			err = json.Unmarshal(data, &docs[i])
		}
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(2)
		}
	}
	var diffs []diff
	compare("", docs[0], docs[1], &diffs)
	patterns := strings.Split(*allow, ",")
	unexpected := 0
	for _, d := range diffs {
		status := "ALLOWED   "
		if !allowed(d.path, patterns) {
			status = "UNEXPECTED"
			unexpected++
		}
		fmt.Printf("%s %s: %s\n", status, d.path, d.detail)
	}
	fmt.Printf("%d differing paths, %d unexpected\n", len(diffs), unexpected)
	if unexpected > 0 {
		os.Exit(1)
	}
}

func allowed(path string, patterns []string) bool {
	segments := strings.Split(index.ReplaceAllString(path, ""), ".")
	for _, p := range patterns {
		ps := strings.Split(strings.TrimSpace(p), ".")
		if len(ps) > len(segments) {
			continue
		}
		match := true
		for i, s := range ps {
			if s != "*" && s != segments[i] {
				match = false
				break
			}
		}
		if match {
			return true
		}
	}
	return false
}

func join(path, key string) string {
	if path == "" {
		return key
	}
	return path + "." + key
}

func compare(path string, a, b any, diffs *[]diff) {
	switch x := a.(type) {
	case map[string]any:
		y, ok := b.(map[string]any)
		if !ok {
			*diffs = append(*diffs, diff{path, fmt.Sprintf("object vs %s", kind(b))})
			return
		}
		keys := []string{}
		for k := range x {
			keys = append(keys, k)
		}
		for k := range y {
			if _, ok := x[k]; !ok {
				keys = append(keys, k)
			}
		}
		slices.Sort(keys)
		for _, k := range keys {
			va, inA := x[k]
			vb, inB := y[k]
			switch {
			case !inA:
				*diffs = append(*diffs, diff{join(path, k), "only in after"})
			case !inB:
				*diffs = append(*diffs, diff{join(path, k), "only in before"})
			default:
				compare(join(path, k), va, vb, diffs)
			}
		}
	case []any:
		y, ok := b.([]any)
		if !ok {
			*diffs = append(*diffs, diff{path, fmt.Sprintf("array vs %s", kind(b))})
			return
		}
		if numeric(x) && numeric(y) {
			if len(x) != len(y) {
				*diffs = append(*diffs, diff{path, fmt.Sprintf("length %d vs %d", len(x), len(y))})
				return
			}
			count, worst := 0, 0.0
			for i := range x {
				if d := math.Abs(x[i].(float64) - y[i].(float64)); d != 0 {
					count++
					worst = math.Max(worst, d)
				}
			}
			if count > 0 {
				*diffs = append(*diffs, diff{path, fmt.Sprintf("%d of %d values differ, max abs diff %g", count, len(x), worst)})
			}
			return
		}
		if len(x) != len(y) {
			*diffs = append(*diffs, diff{path, fmt.Sprintf("length %d vs %d", len(x), len(y))})
		}
		for i := range min(len(x), len(y)) {
			compare(fmt.Sprintf("%s[%d]", path, i), x[i], y[i], diffs)
		}
	default:
		if kind(a) != kind(b) || a != b {
			*diffs = append(*diffs, diff{path, fmt.Sprintf("%s vs %s", short(a), short(b))})
		}
	}
}

func numeric(x []any) bool {
	for _, v := range x {
		if _, ok := v.(float64); !ok {
			return false
		}
	}
	return len(x) > 0
}

func kind(v any) string {
	switch v.(type) {
	case nil:
		return "null"
	case map[string]any:
		return "object"
	case []any:
		return "array"
	default:
		return fmt.Sprintf("%T", v)
	}
}

func short(v any) string {
	s := fmt.Sprintf("%v", v)
	if v == nil {
		s = "null"
	}
	if len(s) > 80 {
		s = s[:77] + "..."
	}
	return s
}
