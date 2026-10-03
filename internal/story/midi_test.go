package story

import (
	"bytes"
	"testing"

	"github.com/cwbudde/AudioVisualizer/internal/audioanalysis"
	"github.com/cwbudde/midi/smf"
)

func TestMIDITicksAndDrums(t *testing.T) {
	for _, aligned := range []bool{false, true} {
		g, err := NewGrid(audioanalysis.Rhythm{BPM: 105, BeatOrigin: 0.038}, 10)
		if err != nil {
			t.Fatal(err)
		}
		s := &Story{Grid: g, Key: KeyEstimate{Tonic: 7, Mode: "major"}}
		s.Lead.Clean = []StoryNote{{Slot: 4, Slots: 2, MIDI: 67, Strength: 1, Voice: "lead"}, {Slot: 9, Slots: 1, MIDI: 71, Strength: 0.3, Voice: "arp"}}
		drums := []audioanalysis.Event{{Time: 1, Strength: 1, Kind: "kick"}, {Time: 1.5, Strength: 1, Kind: "snare"}, {Time: 2, Strength: 1, Kind: "hat"}}
		var b bytes.Buffer
		if err := smf.Write(&b, s.MIDI(drums, aligned)); err != nil {
			t.Fatal(err)
		}
		f, err := smf.Read(&b)
		if err != nil {
			t.Fatal(err)
		}
		offset := 32
		if aligned {
			offset = 0
		}
		on := func(track []smf.Event) []smf.Event {
			out := []smf.Event{}
			for _, e := range track {
				if e.Data[0]&0xF0 == 0x90 {
					out = append(out, e)
				}
			}
			return out
		}
		lead, arp := on(f.Tracks[1]), on(f.Tracks[2])
		if len(lead) != 1 || lead[0].Tick != offset+120*4 || lead[0].Data[1] != 67 || lead[0].Data[2] != 127 {
			t.Fatalf("aligned=%v lead %+v", aligned, lead)
		}
		if len(arp) != 1 || arp[0].Tick != offset+120*9 || arp[0].Data[0] != 0x91 || arp[0].Data[2] != 40 {
			t.Fatalf("aligned=%v arp %+v", aligned, arp)
		}
		keys := []byte{}
		for _, e := range on(f.Tracks[6]) {
			if e.Data[0] != 0x99 {
				t.Fatalf("drum on channel %d", e.Data[0]&15)
			}
			keys = append(keys, e.Data[1])
		}
		if !bytes.Equal(keys, []byte{36, 38, 42}) {
			t.Fatalf("drum keys %v", keys)
		}
	}
}
