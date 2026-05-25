/* GPX: This file contains synthetic SVG paths for the demo.
   Replace demoMapPaths with real GPS-derived paths when coordinates are available.
   Each trail.coordinates → SVG path via projection function (see ForfaitMap.tsx). */

export interface DemoPathData {
  trailId: string;
  path: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  labelX: number;
  labelY: number;
}

export const demoMapPaths: DemoPathData[] = [
  {
    trailId: "demo-01",
    path: "M 120 250 C 180 230, 220 280, 280 260 C 330 240, 350 300, 400 290",
    startX: 120, startY: 250,
    endX: 400, endY: 290,
    labelX: 260, labelY: 235,
  },
  {
    trailId: "demo-02",
    path: "M 450 180 C 420 230, 480 260, 460 310 C 440 360, 500 390, 480 440 C 460 490, 510 520, 490 560",
    startX: 450, startY: 180,
    endX: 490, endY: 560,
    labelX: 475, labelY: 370,
  },
  {
    trailId: "demo-03",
    path: "M 800 130 C 770 180, 820 210, 790 260 C 760 310, 810 340, 780 390 C 750 440, 800 470, 770 520",
    startX: 800, startY: 130,
    endX: 770, endY: 520,
    labelX: 785, labelY: 325,
  },
  {
    trailId: "demo-04",
    path: "M 850 100 C 830 150, 860 180, 840 230 C 820 280, 850 310, 830 360 C 810 410, 840 440, 820 490 C 800 540, 830 570, 810 620",
    startX: 850, startY: 100,
    endX: 810, endY: 620,
    labelX: 835, labelY: 360,
  },
  {
    trailId: "demo-05",
    path: "M 80 180 C 200 150, 300 200, 420 170 C 530 140, 620 190, 720 165 C 790 145, 850 180, 920 160",
    startX: 80, startY: 180,
    endX: 920, endY: 160,
    labelX: 500, labelY: 155,
  },
  {
    trailId: "demo-06",
    path: "M 300 640 C 330 600, 310 570, 350 540 C 390 510, 370 480, 410 450 C 450 420, 430 390, 470 360",
    startX: 300, startY: 640,
    endX: 470, endY: 360,
    labelX: 390, labelY: 500,
  },
  {
    trailId: "demo-07",
    path: "M 60 380 C 160 350, 220 420, 320 390 C 420 360, 480 440, 580 410 C 680 380, 740 460, 840 430 C 890 415, 930 450, 960 430",
    startX: 60, startY: 380,
    endX: 960, endY: 430,
    labelX: 510, labelY: 395,
  },
  {
    trailId: "demo-08",
    path: "M 220 280 C 280 230, 360 250, 390 320 C 420 390, 370 440, 300 420 C 230 400, 180 350, 200 300 Z",
    startX: 220, startY: 280,
    endX: 220, endY: 280,
    labelX: 300, labelY: 330,
  },
];
