package controller

import (
	"testing"
	"time"
)

func TestLoginAttemptTrackerLocksAndResets(t *testing.T) {
	tracker := newLoginAttemptTracker(2, time.Minute)
	now := time.Now()
	key := "alice|127.0.0.1"

	if tracker.IsLocked(key, now) {
		t.Fatal("IsLocked() = true, want false before failures")
	}
	if tracker.RecordFailure(key, now) {
		t.Fatal("RecordFailure() = true, want false before limit")
	}
	if !tracker.RecordFailure(key, now) {
		t.Fatal("RecordFailure() = false, want true at limit")
	}
	if !tracker.IsLocked(key, now.Add(time.Second)) {
		t.Fatal("IsLocked() = false, want true during lockout")
	}

	tracker.Reset(key)
	if tracker.IsLocked(key, now.Add(time.Second)) {
		t.Fatal("IsLocked() = true, want false after reset")
	}
}

func TestLoginAttemptTrackerExpiresLock(t *testing.T) {
	tracker := newLoginAttemptTracker(1, time.Minute)
	now := time.Now()
	key := "alice|127.0.0.1"

	if !tracker.RecordFailure(key, now) {
		t.Fatal("RecordFailure() = false, want true at limit")
	}
	if tracker.IsLocked(key, now.Add(2*time.Minute)) {
		t.Fatal("IsLocked() = true, want false after lockout expires")
	}
}
