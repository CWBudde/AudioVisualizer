package story

import (
	"github.com/cwbudde/AudioVisualizer/internal/audioanalysis"
	"github.com/cwbudde/algo-dsp/measure/music/melody"
)

// CleanParams controls note cleanup. Notes at or below FloorMIDI are the
// tracker's pinned lowest candidate (bleed or octave errors), not pitches.
type CleanParams struct {
	FloorMIDI        int     `json:"floorMidi"`
	MinStrength      float64 `json:"minStrength"`
	OffGridMS        float64 `json:"offGridMS"`
	OctaveWindowBars float64 `json:"octaveWindowBars"`
	OctaveSpread     float64 `json:"octaveSpreadSemitones"`
	NeighbourSpread  int     `json:"octaveNeighbourSpreadSemitones"`
	PeriodSlots      int     `json:"octavePeriodSixteenths"`
	PeriodVotes      int     `json:"octavePeriodMinVotes"`
	ArpMinRun        int     `json:"arpMinRun"`
	ArpMaxGapSlots   int     `json:"arpMaxGapSixteenths"`
	ArpMaxNoteSlots  int     `json:"arpMaxNoteSixteenths"`
}

// The spec's ±13 semitone spread and 5 semitone neighbour agreement folded
// genuine arpeggio leaps (G5 G4 F#5) and the two-register breakdown; the
// defaults are wider and a bar-periodic vote runs first.
func LeadCleanParams() CleanParams { return CleanParams{52, 0.35, 50, 1, 19, 2, 16, 2, 4, 2, 2} }
func BassCleanParams() CleanParams { return CleanParams{28, 0.35, 50, 1, 19, 2, 16, 2, 4, 2, 2} }

func (p CleanParams) options() []melody.CleanOption {
	return []melody.CleanOption{
		melody.WithFloorMIDI(p.FloorMIDI),
		melody.WithMinStrength(p.MinStrength),
		melody.WithOffGridMS(p.OffGridMS),
		melody.WithOctaveWindow(p.OctaveWindowBars, p.OctaveSpread),
		melody.WithNeighbourSpread(p.NeighbourSpread),
		melody.WithOctavePeriod(p.PeriodSlots, p.PeriodVotes),
		melody.WithArpeggio(p.ArpMinRun, p.ArpMaxGapSlots, p.ArpMaxNoteSlots),
	}
}

// StoryNote is a cleaned, grid-quantised note (melody.CleanNote with the
// story.json field names). Seconds stay measured; the sixteenth fields are
// the quantised position.
type StoryNote struct {
	Start       float64      `json:"startSeconds"`
	End         float64      `json:"endSeconds"`
	Slot        int          `json:"startSixteenth"`
	Slots       int          `json:"sixteenths"`
	MIDI        int          `json:"midi"`
	RawMIDI     int          `json:"rawMidi"`
	OctaveShift int          `json:"octaveShift,omitempty"`
	Strength    float64      `json:"strength"`
	Voice       melody.Voice `json:"voice"`
	OffsetMS    float64      `json:"gridOffsetMS"`
	OffGrid     bool         `json:"offGrid,omitempty"`
	RawIndex    int          `json:"rawIndex"`
}

// RawNote is a tracker note with the reason it was dropped, if any.
type RawNote struct {
	audioanalysis.Note
	Dropped melody.DropReason `json:"dropped,omitempty"`
}

// CleanNotes runs melody.Clean with p and returns the cleaned notes and all
// raw notes (rounded as Clean sees them) with their drop reasons.
func CleanNotes(in []audioanalysis.Note, g Grid, p CleanParams) ([]StoryNote, []RawNote, error) {
	notes := make([]melody.Note, len(in))
	raw := make([]RawNote, len(in))
	for i, n := range in {
		notes[i] = melody.Note(n) // audioanalysis.Note mirrors melody.Note field for field
		raw[i].Note = audioanalysis.Note{Start: r6(n.Start), End: r6(n.End), MIDI: n.MIDI, Strength: r3(n.Strength)}
	}
	clean, dropped, err := melody.Clean(notes, g.Grid, p.options()...)
	if err != nil {
		return nil, nil, err
	}
	for _, d := range dropped {
		raw[d.Index].Dropped = d.Reason
	}
	out := make([]StoryNote, len(clean))
	for i, n := range clean {
		out[i] = StoryNote(n) // StoryNote mirrors melody.CleanNote field for field
	}
	return out, raw, nil
}

// cleanNotes and melodyNotes convert story notes for the melody, harmony and
// motif packages.
func cleanNotes(in []StoryNote) []melody.CleanNote {
	out := make([]melody.CleanNote, len(in))
	for i, n := range in {
		out[i] = melody.CleanNote(n) // StoryNote mirrors melody.CleanNote field for field
	}
	return out
}

// melodyNotes keeps the four melody.Note fields of each note; StoryNote has
// no melody.Note inside, so there is no direct conversion.
func melodyNotes(in []StoryNote) []melody.Note {
	out := make([]melody.Note, len(in))
	for i, n := range in {
		out[i] = melody.Note{Start: n.Start, End: n.End, MIDI: n.MIDI, Strength: n.Strength}
	}
	return out
}
