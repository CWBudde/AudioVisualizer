// Package smf writes and reads Standard MIDI Files (format 1) with explicit
// note-offs and no running status. It has no analysis dependencies.
package smf

import (
	"bufio"
	"bytes"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"math"
	"sort"
)

// PPQ is the tick resolution per quarter note.
const PPQ = 480

// Event is one timed message. Data is the complete message: status and data
// bytes for channel events, FF type length payload for meta events.
type Event struct {
	Tick int
	Data []byte
}

// Order of simultaneous events: meta, note-off, other channel, note-on.
func (e Event) order() int {
	switch s := e.Data[0]; {
	case s == 0xFF:
		return 0
	case s&0xF0 == 0x80:
		return 1
	case s&0xF0 == 0x90:
		return 3
	}
	return 2
}

type Track struct{ Events []Event }

func (t *Track) add(tick int, data ...byte) { t.Events = append(t.Events, Event{max(0, tick), data}) }

func (t *Track) meta(tick int, kind byte, payload []byte) {
	t.add(tick, append(append([]byte{0xFF, kind}, VLQ(uint32(len(payload)))...), payload...)...)
}

func (t *Track) Name(name string)           { t.meta(0, 0x03, []byte(name)) }
func (t *Track) Text(tick int, s string)    { t.meta(tick, 0x01, []byte(s)) }
func (t *Track) Marker(tick int, s string)  { t.meta(tick, 0x06, []byte(s)) }
func (t *Track) Program(tick, ch, prog int) { t.add(tick, 0xC0|byte(ch&15), byte(prog&127)) }
func (t *Track) TimeSignature(tick, num, den int) {
	t.meta(tick, 0x58, []byte{byte(num), byte(math.Round(math.Log2(float64(den)))), 24, 8})
}

// Tempo stores microseconds per quarter note, rounded.
func (t *Track) Tempo(tick int, bpm float64) {
	us := uint32(math.Round(60e6 / bpm))
	t.meta(tick, 0x51, []byte{byte(us >> 16), byte(us >> 8), byte(us)})
}

// KeySignature takes sharps (negative for flats) and the mode.
func (t *Track) KeySignature(tick, sharps int, minor bool) {
	m := byte(0)
	if minor {
		m = 1
	}
	t.meta(tick, 0x59, []byte{byte(int8(sharps)), m})
}

// Note adds an explicit note-on/note-off pair; off is at least on+1.
func (t *Track) Note(ch, key, vel, on, off int) {
	vel = min(127, max(1, vel))
	t.add(on, 0x90|byte(ch&15), byte(key&127), byte(vel))
	t.add(max(on+1, off), 0x80|byte(ch&15), byte(key&127), 0)
}

// VLQ encodes n as a MIDI variable-length quantity (n < 2^28).
func VLQ(n uint32) []byte {
	out := []byte{byte(n & 0x7F)}
	for n >>= 7; n > 0; n >>= 7 {
		out = append([]byte{byte(n&0x7F) | 0x80}, out...)
	}
	return out
}

// Write emits a format-1 file. Events are stably sorted by tick and kind, so
// insertion order breaks remaining ties.
func Write(w io.Writer, tracks []*Track) error {
	var b bytes.Buffer
	b.WriteString("MThd")
	binary.Write(&b, binary.BigEndian, uint32(6))
	binary.Write(&b, binary.BigEndian, []uint16{1, uint16(len(tracks)), PPQ})
	for _, t := range tracks {
		events := append([]Event(nil), t.Events...)
		sort.SliceStable(events, func(i, j int) bool {
			if events[i].Tick != events[j].Tick {
				return events[i].Tick < events[j].Tick
			}
			return events[i].order() < events[j].order()
		})
		var body bytes.Buffer
		tick := 0
		for _, e := range events {
			body.Write(VLQ(uint32(e.Tick - tick)))
			body.Write(e.Data)
			tick = e.Tick
		}
		body.Write([]byte{0, 0xFF, 0x2F, 0})
		b.WriteString("MTrk")
		binary.Write(&b, binary.BigEndian, uint32(body.Len()))
		b.Write(body.Bytes())
	}
	_, err := w.Write(b.Bytes())
	return err
}

type File struct {
	Format, Division int
	Tracks           [][]Event // absolute ticks, end-of-track included
}

// Read parses files written without running status.
func Read(r io.Reader) (*File, error) {
	br := bufio.NewReader(r)
	chunk := func() (string, []byte, error) {
		head := make([]byte, 8)
		if _, err := io.ReadFull(br, head); err != nil {
			return "", nil, err
		}
		data := make([]byte, binary.BigEndian.Uint32(head[4:]))
		_, err := io.ReadFull(br, data)
		return string(head[:4]), data, err
	}
	id, h, err := chunk()
	if err != nil {
		return nil, err
	}
	if id != "MThd" || len(h) != 6 {
		return nil, errors.New("smf: missing header")
	}
	f := &File{Format: int(binary.BigEndian.Uint16(h)), Division: int(binary.BigEndian.Uint16(h[4:]))}
	for range int(binary.BigEndian.Uint16(h[2:])) {
		id, data, err := chunk()
		if err != nil {
			return nil, err
		}
		if id != "MTrk" {
			return nil, fmt.Errorf("smf: unexpected chunk %q", id)
		}
		events, err := parseTrack(data)
		if err != nil {
			return nil, err
		}
		f.Tracks = append(f.Tracks, events)
	}
	return f, nil
}

func parseTrack(d []byte) ([]Event, error) {
	var out []Event
	tick, i := 0, 0
	vlq := func() (int, error) {
		n := 0
		for k := 0; k < 4; k++ {
			if i >= len(d) {
				return 0, io.ErrUnexpectedEOF
			}
			c := d[i]
			i++
			n = n<<7 | int(c&0x7F)
			if c&0x80 == 0 {
				return n, nil
			}
		}
		return 0, errors.New("smf: VLQ too long")
	}
	for i < len(d) {
		delta, err := vlq()
		if err != nil {
			return nil, err
		}
		tick += delta
		if i >= len(d) {
			return nil, io.ErrUnexpectedEOF
		}
		start, s := i, d[i]
		switch {
		case s == 0xFF:
			i += 2
			n, err := vlq()
			if err != nil {
				return nil, err
			}
			i += n
		case s&0xF0 == 0xC0 || s&0xF0 == 0xD0:
			i += 2
		case s >= 0x80 && s < 0xF0:
			i += 3
		default:
			return nil, fmt.Errorf("smf: unsupported status %#x", s)
		}
		if i > len(d) {
			return nil, io.ErrUnexpectedEOF
		}
		out = append(out, Event{tick, append([]byte(nil), d[start:i]...)})
	}
	return out, nil
}
