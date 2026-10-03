package audioanalysis

import (
	"fmt"
	"os/exec"
	"runtime/debug"
	"strings"
)

// ModuleProvenance reports, for each github.com/cwbudde/<name> module linked
// into the running binary, the version it was built against. A module that
// go.mod replaces with a local directory reports that checkout's commit and a
// "<name>Dirty" entry instead, because its version string would be
// meaningless. Relative replace paths resolve against the working directory,
// which is the repository root for every bun script. Modules not linked into
// the binary are omitted.
func ModuleProvenance(names ...string) (map[string]string, error) {
	info, ok := debug.ReadBuildInfo()
	if !ok {
		return nil, fmt.Errorf("provenance: binary has no build info")
	}
	deps := map[string]*debug.Module{}
	for _, d := range info.Deps {
		deps[d.Path] = d
	}
	out := map[string]string{}
	for _, name := range names {
		d := deps["github.com/cwbudde/"+name]
		switch {
		case d == nil:
		case d.Replace == nil:
			out[name] = d.Version
		case d.Replace.Version != "":
			out[name] = d.Replace.Path + "@" + d.Replace.Version
		default:
			v, err := exec.Command("git", "-C", d.Replace.Path, "rev-parse", "HEAD").Output()
			if err != nil {
				return nil, fmt.Errorf("provenance %s: %w", name, err)
			}
			dirty, err := exec.Command("git", "-C", d.Replace.Path, "status", "--porcelain").Output()
			if err != nil {
				return nil, fmt.Errorf("provenance %s: %w", name, err)
			}
			out[name] = strings.TrimSpace(string(v))
			out[name+"Dirty"] = fmt.Sprint(len(dirty) > 0)
		}
	}
	return out, nil
}
