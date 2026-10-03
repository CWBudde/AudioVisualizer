package story

import (
	"math"
	"sort"

	"github.com/cwbudde/AudioVisualizer/internal/audioanalysis"
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

// StoryNote is a cleaned, grid-quantised note. Seconds stay measured; the
// sixteenth fields are the quantised position.
type StoryNote struct {
	Start       float64 `json:"startSeconds"`
	End         float64 `json:"endSeconds"`
	Slot        int     `json:"startSixteenth"`
	Slots       int     `json:"sixteenths"`
	MIDI        int     `json:"midi"`
	RawMIDI     int     `json:"rawMidi"`
	OctaveShift int     `json:"octaveShift,omitempty"`
	Strength    float64 `json:"strength"`
	Voice       string  `json:"voice"`
	OffsetMS    float64 `json:"gridOffsetMS"`
	OffGrid     bool    `json:"offGrid,omitempty"`
	RawIndex    int     `json:"rawIndex"`
}

// RawNote is a tracker note with the reason it was dropped, if any.
type RawNote struct {
	audioanalysis.Note
	Dropped string `json:"dropped,omitempty"`
}

// CleanNotes drops floor and weak notes, quantises starts to sixteenths,
// keeps one note per slot, corrects isolated octave errors and splits short
// runs into an "arp" voice. Raw notes are returned with drop reasons.
func CleanNotes(in []audioanalysis.Note, g Grid, p CleanParams) ([]StoryNote, []RawNote) {
	raw := make([]RawNote, len(in))
	notes := []StoryNote{}
	for i, n := range in {
		n.Start, n.End, n.Strength = r6(n.Start), r6(n.End), r3(n.Strength)
		raw[i].Note = n
		switch {
		case n.MIDI <= p.FloorMIDI:
			raw[i].Dropped = "floor"
			continue
		case n.Strength < p.MinStrength:
			raw[i].Dropped = "weak"
			continue
		}
		slot := g.Slot(n.Start)
		offset := (n.Start - g.SlotTime(slot)) * 1000
		notes = append(notes, StoryNote{Start: n.Start, End: n.End, Slot: slot, Slots: max(1, g.Slot(n.End)-slot), MIDI: n.MIDI, RawMIDI: n.MIDI,
			Strength: n.Strength, OffsetMS: r3(offset), OffGrid: math.Abs(offset) > p.OffGridMS, RawIndex: i})
	}
	sort.SliceStable(notes, func(i, j int) bool { return notes[i].Slot < notes[j].Slot })
	// Monophonic: one note per slot (strongest by strength × duration), and
	// each note ends no later than the next one starts.
	mono := []StoryNote{}
	for _, n := range notes {
		if k := len(mono) - 1; k >= 0 && mono[k].Slot == n.Slot {
			if n.Strength*(n.End-n.Start) > mono[k].Strength*(mono[k].End-mono[k].Start) {
				raw[mono[k].RawIndex].Dropped = "duplicate"
				mono[k] = n
			} else {
				raw[n.RawIndex].Dropped = "duplicate"
			}
			continue
		}
		mono = append(mono, n)
	}
	for i := 0; i+1 < len(mono); i++ {
		next := mono[i+1]
		mono[i].End = math.Min(mono[i].End, next.Start)
		mono[i].Slots = max(1, min(mono[i].Slots, next.Slot-mono[i].Slot))
	}
	correctOctaves(mono, g, p)
	splitVoices(mono, p)
	return mono, raw
}

// correctOctaves first lets repeating material vote: notes of the same pitch
// class at the same position one and two periods away decide the octave, and
// a note they confirm is left alone. Remaining notes are (a) moved by an
// octave towards the duration-weighted median of the surrounding bars when
// more than OctaveSpread semitones away, and (b) folded when they sit an
// octave (±1) from both close neighbours that agree within NeighbourSpread.
func correctOctaves(notes []StoryNote, g Grid, p CleanParams) {
	pitch := make([]int, len(notes))
	bySlot := map[int]int{}
	for i, n := range notes {
		pitch[i] = n.MIDI
		bySlot[n.Slot] = i
	}
	settled := make([]bool, len(notes))
	for i, n := range notes {
		votes := map[int]int{}
		for _, k := range []int{-2, -1, 1, 2} {
			if j, ok := bySlot[n.Slot+k*p.PeriodSlots]; ok && (pitch[j]-pitch[i])%12 == 0 && abs(pitch[j]-pitch[i]) <= 24 {
				votes[pitch[j]-pitch[i]]++
			}
		}
		best := 0
		for _, o := range []int{-24, -12, 12, 24} {
			if votes[o] > votes[best] {
				best = o
			}
		}
		if votes[best] > 0 && (best == 0 || votes[best] >= p.PeriodVotes) {
			notes[i].MIDI += best
			settled[i] = true
		}
	}
	window := p.OctaveWindowBars * g.BarSeconds
	for i, n := range notes {
		if settled[i] {
			continue
		}
		type wp struct{ midi, weight float64 }
		around := []wp{}
		total := 0.0
		for j, m := range notes {
			if j != i && math.Abs(m.Start-n.Start) <= window {
				around = append(around, wp{float64(pitch[j]), m.End - m.Start})
				total += m.End - m.Start
			}
		}
		if len(around) < 3 {
			continue
		}
		sort.Slice(around, func(a, b int) bool { return around[a].midi < around[b].midi })
		median, acc := around[len(around)-1].midi, 0.0
		for _, a := range around {
			if acc += a.weight; acc >= total/2 {
				median = a.midi
				break
			}
		}
		if d := float64(n.MIDI) - median; math.Abs(d) > p.OctaveSpread {
			notes[i].MIDI -= 12 * int(math.Copysign(1, d))
			settled[i] = true
		}
	}
	for i := 1; i+1 < len(notes); i++ {
		prev, n, next := notes[i-1], notes[i], notes[i+1]
		if settled[i] || n.Slot-prev.Slot > 4 || next.Slot-n.Slot > 4 || abs(prev.MIDI-next.MIDI) > p.NeighbourSpread {
			continue
		}
		a, b := n.MIDI-prev.MIDI, n.MIDI-next.MIDI
		if abs(abs(a)-12) <= 1 && abs(abs(b)-12) <= 1 && (a > 0) == (b > 0) {
			notes[i].MIDI -= 12 * sign(a)
		}
	}
	for i := range notes {
		notes[i].OctaveShift = notes[i].MIDI - notes[i].RawMIDI
	}
}

// splitVoices labels runs of at least ArpMinRun short, closely spaced notes
// as "arp" and everything else as "lead".
func splitVoices(notes []StoryNote, p CleanParams) {
	short := func(n StoryNote) bool { return n.Slots <= p.ArpMaxNoteSlots }
	for start := 0; start < len(notes); {
		end := start + 1
		for short(notes[start]) && end < len(notes) && short(notes[end]) && notes[end].Slot-(notes[end-1].Slot+notes[end-1].Slots) <= p.ArpMaxGapSlots {
			end++
		}
		voice := "lead"
		if short(notes[start]) && end-start >= p.ArpMinRun {
			voice = "arp"
		}
		for i := start; i < end; i++ {
			notes[i].Voice = voice
		}
		start = end
	}
}

func abs(x int) int {
	if x < 0 {
		return -x
	}
	return x
}

func sign(x int) int {
	if x < 0 {
		return -1
	}
	return 1
}
