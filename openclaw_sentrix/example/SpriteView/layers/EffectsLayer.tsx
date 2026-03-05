'use client';

import { useCallback, useMemo } from 'react';
import { rooms, controlRoom, quarantineRoom, entertainmentRoom } from '../config/roomLayout';

const S = 3;

export function EffectsLayer() {
  const roomLabels = useMemo(
    () =>
      rooms.map((room) => (
        <pixiText
          key={room.id}
          text={room.name}
          x={room.x + 15 * S}
          y={room.y + 13 * S}
          style={{
            fontSize: 11 * S,
            fill: '#9ca3af',
            fontFamily: 'monospace',
            fontWeight: 'bold',
          }}
        />
      )),
    [],
  );

  return (
    <pixiContainer>
      {roomLabels}
      <pixiText
        text="Control Room"
        x={controlRoom.x + 15 * S}
        y={controlRoom.y + 13 * S}
        style={{
          fontSize: 11 * S,
          fill: '#9b59b6',
          fontFamily: 'monospace',
          fontWeight: 'bold',
        }}
      />
      <pixiText
        text="Quarantine"
        x={quarantineRoom.x + 15 * S}
        y={quarantineRoom.y + 13 * S}
        style={{
          fontSize: 11 * S,
          fill: '#ff3355',
          fontFamily: 'monospace',
          fontWeight: 'bold',
        }}
      />
      <pixiText
        text="Entertainment"
        x={entertainmentRoom.x + 15 * S}
        y={entertainmentRoom.y + 13 * S}
        style={{
          fontSize: 11 * S,
          fill: '#4a9a9a',
          fontFamily: 'monospace',
          fontWeight: 'bold',
        }}
      />
    </pixiContainer>
  );
}
