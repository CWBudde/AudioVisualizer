package story

import "math"

// CompactStory is the public/analysis/story.json contract for the video app.
// Keep it lean and stable; src/v3/story.ts mirrors it.
type CompactStory struct {
	SchemaVersion int              `json:"schemaVersion"`
	SourceSHA256  string           `json:"sourceSha256"`
	BPM           float64          `json:"bpm"`
	BeatOrigin    float64          `json:"beatOriginSeconds"`
	Key           CompactKey       `json:"key"`
	Bars          []CompactBar     `json:"bars"`
	Sections      []CompactSection `json:"sections"`
	Leitmotifs    []CompactMotif   `json:"leitmotifs"`
	LeadNotes     []CompactNote    `json:"leadNotes"`
	BassNotes     []CompactNote    `json:"bassNotes"`
	Chords        []CompactChord   `json:"chords"`
}

type CompactKey struct {
	Name              string `json:"name"`
	Tonic             int    `json:"tonic"`
	Mode              string `json:"mode"`
	RelativeAmbiguous bool   `json:"relativeAmbiguous"`
}

type CompactBar struct {
	Index   int      `json:"index"`
	Start   float64  `json:"startSeconds"`
	End     float64  `json:"endSeconds"`
	Label   string   `json:"label"`
	Section string   `json:"section"`
	Cue     string   `json:"cue"`
	Chord   string   `json:"chord"`
	Roles   []string `json:"roles"`
	Motifs  []string `json:"motifs"`
}

type CompactSection struct {
	Label    string  `json:"label"`
	Start    float64 `json:"startSeconds"`
	End      float64 `json:"endSeconds"`
	FirstBar int     `json:"firstBar"`
	LastBar  int     `json:"lastBar"`
	Cue      string  `json:"cue"`
}

type CompactOccurrence struct {
	Start         float64 `json:"startSeconds"`
	End           float64 `json:"endSeconds"`
	Transposition int     `json:"transposition"`
	Similarity    float64 `json:"similarity"`
	Variant       string  `json:"variant"`
}

type CompactMotif struct {
	ID            string              `json:"id"`
	Role          string              `json:"role"`
	Rank          int                 `json:"rank"`
	PrototypeMIDI []int               `json:"prototypeMidi"`
	Occurrences   []CompactOccurrence `json:"occurrences"`
}

type CompactNote struct {
	Start    float64 `json:"startSeconds"`
	End      float64 `json:"endSeconds"`
	MIDI     int     `json:"midi"`
	Velocity int     `json:"velocity"`
	Voice    string  `json:"voice"`
	Motif    string  `json:"motif,omitempty"`
}

type CompactChord struct {
	Start   float64 `json:"startSeconds"`
	End     float64 `json:"endSeconds"`
	Root    int     `json:"root"`
	Quality string  `json:"quality"`
	Symbol  string  `json:"symbol"`
	Bass    int     `json:"bass"`
}

// Compact derives the public contract. Notes carry the best-ranked
// leitmotif whose occurrence contains them; a bar's chord is the one
// sounding longest in it.
func (s *Story) Compact(sourceSHA256 string) CompactStory {
	c := CompactStory{SchemaVersion: 1, SourceSHA256: sourceSHA256, BPM: r6(s.Grid.BPM()), BeatOrigin: r6(s.Grid.Origin()),
		Key: CompactKey{s.Key.Name, s.Key.Tonic, s.Key.Mode, s.Key.RelativeAmbiguous}, Leitmotifs: []CompactMotif{}}
	for _, sec := range s.Sections {
		c.Sections = append(c.Sections, CompactSection{sec.Label, sec.Start, sec.End, sec.FirstBar, sec.LastBar, sec.Cue})
	}
	leadMotif, bassMotif := map[int]string{}, map[int]string{}
	for rank := len(s.Leitmotifs); rank >= 1; rank-- {
		for _, m := range s.Motifs {
			if !m.Leitmotif || m.Rank != rank {
				continue
			}
			target := leadMotif
			if m.Source == "bass" {
				target = bassMotif
			}
			for _, o := range m.Occurrences {
				for _, k := range o.NoteIndices {
					target[k] = m.ID
				}
			}
		}
	}
	for _, id := range s.Leitmotifs {
		for _, m := range s.Motifs {
			if m.ID != id {
				continue
			}
			cm := CompactMotif{ID: m.ID, Role: string(m.Role), Rank: m.Rank, PrototypeMIDI: m.PrototypeMIDI}
			for _, o := range m.Occurrences {
				cm.Occurrences = append(cm.Occurrences, CompactOccurrence{o.Start, o.End, o.Transposition, o.Similarity, string(o.Variant)})
			}
			c.Leitmotifs = append(c.Leitmotifs, cm)
		}
	}
	notes := func(in []StoryNote, motif map[int]string) []CompactNote {
		out := []CompactNote{}
		for i, n := range in {
			out = append(out, CompactNote{r6(n.Start), r6(n.End), n.MIDI, velocity(n.Strength), string(n.Voice), motif[i]})
		}
		return out
	}
	c.LeadNotes, c.BassNotes = notes(s.Lead.Clean, leadMotif), notes(s.Bass.Clean, bassMotif)
	for _, ch := range s.Chords {
		c.Chords = append(c.Chords, CompactChord{ch.Start, ch.End, ch.Root, ch.Quality, ch.Symbol, ch.Bass})
	}
	for _, b := range s.Bars {
		chord, longest := "N", 0.0
		for _, ch := range s.Chords {
			if o := math.Min(b.End, ch.End) - math.Max(b.Start, ch.Start); o > longest+1e-3 {
				chord, longest = ch.Symbol, o
			}
		}
		c.Bars = append(c.Bars, CompactBar{b.Index, b.Start, b.End, b.Label, b.Section, b.Cue, chord, b.Roles, b.Motifs})
	}
	return c
}
