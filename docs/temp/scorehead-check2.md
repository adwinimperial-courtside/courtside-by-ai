=== grep instanceId|channelRef|score-header-game ===
76:  // The channelRef guard stops React StrictMode's cleanup → re-run cycle from
90:      .channel(`score-header-game-${game.id}-${scoreHeaderInstanceId.current}`)

=== grep useEffect ===
1:import React, { useState, useEffect, useRef } from "react";
63:  useEffect(() => {
85:  useEffect(() => {
143:  useEffect(() => {
189:  useEffect(() => {
194:  useEffect(() => {
420:  useEffect(() => {

=== NOTE: grep missed the declaration lines ===
Pattern 'instanceId' (lowercase i) does not match 'scoreHeaderInstanceId'
because the variable uses capital-I 'InstanceId'. Case-sensitive grep.
Showing lines 81-84 directly to confirm the fix is present:

  const scoreHeaderInstanceId = useRef(
    `${Math.random().toString(36).slice(2, 8)}`
  );
  const scoreHeaderChannelRef = useRef(null);
