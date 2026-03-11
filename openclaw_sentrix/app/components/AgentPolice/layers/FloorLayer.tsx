"use client";

import { useCallback } from "react";
import { rooms, controlRoom, WORLD_WIDTH, WORLD_HEIGHT } from "../config/roomLayout";
import { WORLD_COLORS } from "../config/spriteConfig";

export function FloorLayer() {
  const draw = useCallback(
    (g: unknown) => {
      const gr = g as {
        clear: () => void;
        setFillStyle: (o: object) => void;
        rect: (a: number, b: number, c: number, d: number) => void;
        fill: () => void;
        setStrokeStyle: (o: object) => void;
        roundRect: (a: number, b: number, c: number, d: number, e: number) => void;
        stroke: () => void;
      };
      gr.clear();
      gr.setFillStyle({ color: WORLD_COLORS.background });
      gr.rect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
      gr.fill();

      for (const room of rooms) {
        gr.setFillStyle({ color: WORLD_COLORS.roomFloor });
        gr.roundRect(room.x, room.y, room.width, room.height, 8);
        gr.fill();
        gr.setStrokeStyle({ width: 2, color: WORLD_COLORS.roomBorder });
        gr.roundRect(room.x, room.y, room.width, room.height, 8);
        gr.stroke();
      }

      gr.setFillStyle({ color: WORLD_COLORS.controlRoomFloor });
      gr.roundRect(controlRoom.x, controlRoom.y, controlRoom.width, controlRoom.height, 8);
      gr.fill();
      gr.setStrokeStyle({ width: 2, color: WORLD_COLORS.controlRoomBorder });
      gr.roundRect(controlRoom.x, controlRoom.y, controlRoom.width, controlRoom.height, 8);
      gr.stroke();
    },
    []
  );

  return <pixiGraphics draw={draw} />;
}
