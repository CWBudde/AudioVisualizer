package story

import (
	"github.com/cwbudde/algo-dsp/measure/music/motif"
)

type MotifParams struct {
	GridWindows         []int   `json:"gridWindowSixteenths"`
	GridMinNotes        int     `json:"gridMinNotes"`
	GridMinSimilarity   float64 `json:"gridMinSimilarity"`
	GridTransposeCost   float64 `json:"gridTranspositionPenalty"`
	Lengths             []int   `json:"lengths"`
	MaxSpanSlots        int     `json:"maxSpanSixteenths"`
	MaxGapSlots         int     `json:"maxGapSixteenths"`
	MinSimilarity       float64 `json:"minSimilarity"`
	MinOccurrences      int     `json:"minOccurrences"`
	IntervalWeight      float64 `json:"intervalWeight"`
	IOIWeight           float64 `json:"ioiWeight"`
	ShiftOverlap        float64 `json:"sameLengthShiftOverlap"`
	CoveredShare        float64 `json:"shorterCoveredShare"`
	ChromaWindowBeats   []int   `json:"chromaWindowBeats"`
	ChromaMinSimilarity float64 `json:"chromaMinSimilarity"`
	ConfirmShare        float64 `json:"chromaConfirmShare"`
	OstinatoShare       float64 `json:"ostinatoShare"`
	Leitmotifs          int     `json:"leitmotifs"`
	LeitmotifOverlap    float64 `json:"leitmotifMaxOverlap"`
	LeitmotifMinRatio   float64 `json:"leitmotifMinSalienceRatio"`
	LeitmotifsPerSource int     `json:"leitmotifsPerSource"`
}

func DefaultMotifParams() MotifParams {
	return MotifParams{[]int{16, 8}, 4, 0.5, 0.1, []int{8, 6, 4}, 32, 4, 0.8, 3, 0.7, 0.3, 0.5, 0.75, []int{8, 4}, 0.85, 0.6, 0.6, 4, 0.5, 0.5, 2}
}

func (p MotifParams) options() []motif.Option {
	return []motif.Option{
		motif.WithGridWindows(p.GridWindows...),
		motif.WithGridMinNotes(p.GridMinNotes),
		motif.WithGridMinSimilarity(p.GridMinSimilarity),
		motif.WithGridTranspositionPenalty(p.GridTransposeCost),
		motif.WithLengths(p.Lengths...),
		motif.WithMaxSpanSlots(p.MaxSpanSlots),
		motif.WithMaxGapSlots(p.MaxGapSlots),
		motif.WithMinSimilarity(p.MinSimilarity),
		motif.WithMinOccurrences(p.MinOccurrences),
		motif.WithDistanceWeights(p.IntervalWeight, p.IOIWeight),
		motif.WithShiftOverlap(p.ShiftOverlap),
		motif.WithCoveredShare(p.CoveredShare),
		motif.WithChromaWindows(p.ChromaWindowBeats...),
		motif.WithChromaMinSimilarity(p.ChromaMinSimilarity),
		motif.WithConfirmShare(p.ConfirmShare),
		motif.WithOstinatoShare(p.OstinatoShare),
		motif.WithLeitmotifs(p.Leitmotifs),
		motif.WithLeitmotifOverlap(p.LeitmotifOverlap),
		motif.WithLeitmotifMinRatio(p.LeitmotifMinRatio),
		motif.WithLeitmotifsPerSource(p.LeitmotifsPerSource),
	}
}

type MotifOccurrence struct {
	MotifID       string        `json:"motifId"`
	Start         float64       `json:"startSeconds"`
	End           float64       `json:"endSeconds"`
	Bar           int           `json:"bar"`
	Slot          int           `json:"startSixteenth"`
	Transposition int           `json:"transposition"`
	Similarity    float64       `json:"similarity"`
	Variant       motif.Variant `json:"variant"`
	NoteIndices   []int         `json:"noteIndices,omitempty"`
}

type SalienceTerms struct {
	Count           float64 `json:"count"`
	Sections        float64 `json:"sections"`
	Prominence      float64 `json:"prominence"`
	Distinctiveness float64 `json:"distinctiveness"`
	Span            float64 `json:"span"`
	Confirmed       float64 `json:"confirmed"`
}

// Motif is motif.Motif with the story.json field names.
type Motif struct {
	ID                string            `json:"id"`
	Source            string            `json:"source"`
	Role              motif.Role        `json:"role"`
	Notes             []string          `json:"notes"`
	SpanBeats         float64           `json:"spanBeats"`
	Intervals         []int             `json:"intervals"`
	IOI               []int             `json:"ioiSixteenths"`
	PrototypeMIDI     []int             `json:"prototypeMidi"`
	Occurrences       []MotifOccurrence `json:"occurrences"`
	Salience          float64           `json:"salience"`
	SalienceTerms     SalienceTerms     `json:"salienceTerms"`
	ConfirmedByChroma bool              `json:"confirmedByChroma"`
	Leitmotif         bool              `json:"leitmotif"`
	Rank              int               `json:"rank,omitempty"`
}

func toMotif(m motif.Motif) Motif {
	out := Motif{ID: m.ID, Source: m.Source, Role: m.Role, Notes: m.Notes, SpanBeats: m.SpanBeats, Intervals: m.Intervals, IOI: m.IOI,
		PrototypeMIDI: m.PrototypeMIDI, Salience: m.Salience,
		SalienceTerms:     SalienceTerms(m.SalienceTerms), // SalienceTerms mirrors motif.SalienceTerms field for field
		ConfirmedByChroma: m.ConfirmedByChroma, Leitmotif: m.Leitmotif, Rank: m.Rank}
	for _, o := range m.Occurrences {
		out.Occurrences = append(out.Occurrences, MotifOccurrence(o)) // MotifOccurrence mirrors motif.Occurrence field for field
	}
	return out
}
