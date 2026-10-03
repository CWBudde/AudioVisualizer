package smf

import (
	"bytes"
	"testing"
)

func TestVLQ(t *testing.T) {
	for n, want := range map[uint32][]byte{0: {0}, 127: {0x7F}, 128: {0x81, 0}, 0x0FFFFFFF: {0xFF, 0xFF, 0xFF, 0x7F}} {
		if got := VLQ(n); !bytes.Equal(got, want) {
			t.Fatalf("VLQ(%#x) = % X, want % X", n, got, want)
		}
	}
}

func TestRoundTrip(t *testing.T) {
	conductor := &Track{}
	conductor.Name("conductor")
	conductor.Tempo(0, 105)
	conductor.TimeSignature(0, 4, 4)
	conductor.Marker(960, "drop")
	lead := &Track{}
	lead.Program(0, 0, 80)
	lead.Note(0, 64, 100, 480, 960)
	lead.Note(0, 67, 90, 960, 1200) // note-on at the tick of the previous note-off
	drums := &Track{}
	drums.Note(9, 36, 127, 0, 60)
	var b bytes.Buffer
	if err := Write(&b, []*Track{conductor, lead, drums}); err != nil {
		t.Fatal(err)
	}
	raw := b.Bytes()
	if !bytes.Equal(raw[:14], []byte{'M', 'T', 'h', 'd', 0, 0, 0, 6, 0, 1, 0, 3, 0x01, 0xE0}) {
		t.Fatalf("header % X", raw[:14])
	}
	f, err := Read(&b)
	if err != nil {
		t.Fatal(err)
	}
	if f.Format != 1 || f.Division != 480 || len(f.Tracks) != 3 {
		t.Fatalf("file %+v", f)
	}
	find := func(track []Event, prefix ...byte) *Event {
		for i := range track {
			if bytes.HasPrefix(track[i].Data, prefix) {
				return &track[i]
			}
		}
		return nil
	}
	if e := find(f.Tracks[0], 0xFF, 0x51, 3); e == nil || !bytes.Equal(e.Data[3:], []byte{0x08, 0xB8, 0x25}) { // 571429 µs
		t.Fatalf("tempo %+v", e)
	}
	if e := find(f.Tracks[0], 0xFF, 0x58, 4); e == nil || !bytes.Equal(e.Data[3:], []byte{4, 2, 0x18, 8}) {
		t.Fatalf("time signature %+v", e)
	}
	if e := find(f.Tracks[0], 0xFF, 0x06); e == nil || e.Tick != 960 || string(e.Data[3:]) != "drop" {
		t.Fatalf("marker %+v", e)
	}
	for _, track := range f.Tracks {
		if last := track[len(track)-1]; !bytes.Equal(last.Data, []byte{0xFF, 0x2F, 0}) {
			t.Fatalf("missing end of track: %+v", last)
		}
	}
	notes := []Event{}
	for _, e := range f.Tracks[1] {
		if e.Data[0]&0xE0 == 0x80 {
			notes = append(notes, e)
		}
	}
	want := []Event{{480, []byte{0x90, 64, 100}}, {960, []byte{0x80, 64, 0}}, {960, []byte{0x90, 67, 90}}, {1200, []byte{0x80, 67, 0}}}
	if len(notes) != len(want) {
		t.Fatalf("notes %+v", notes)
	}
	for i := range want {
		if notes[i].Tick != want[i].Tick || !bytes.Equal(notes[i].Data, want[i].Data) {
			t.Fatalf("note event %d: %+v, want %+v", i, notes[i], want[i])
		}
	}
	if e := find(f.Tracks[2], 0x99, 36); e == nil || e.Tick != 0 {
		t.Fatalf("drum note %+v", e)
	}
}
