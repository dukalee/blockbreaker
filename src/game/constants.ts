// 해상도 (논리 해상도 16:9)
export const LOGICAL_WIDTH = 1280
export const LOGICAL_HEIGHT = 720

// 블록 그리드
export const GRID_COLS = 12
export const GRID_ROWS = 8
export const FILL_RATIO_MIN = 0.4
export const FILL_RATIO_MAX = 0.7
// 낮은 레벨(스테이지 1~LOW_LEVEL_MAX_STAGE)은 블록 수를 이 배율만큼 줄인다.
export const LOW_LEVEL_MAX_STAGE = 3
export const LOW_LEVEL_FILL_SCALE = 0.5

// 게임 규칙
export const INITIAL_LIFE = 3
export const BLOCK_SCORE = 100
export const ITEM_DROP_CHANCE = 0.2
export const ITEM_DURATION_SEC = 10
export const MAX_BALLS = 6

// 난이도 (스테이지당 증가분)
export const BALL_SPEED_STAGE_RATE = 0.05
export const BALL_SPEED_MAX_MULTIPLIER = 2
export const METAL_RATIO_STAGE_STEP = 0.03
export const METAL_RATIO_MAX = 0.1
export const REINFORCED_RATIO_STAGE_STEP = 0.03
export const REINFORCED_RATIO_MAX = 0.3

// 게임 루프
export const UPDATE_STEP_MS = 1000 / 60
export const MAX_FRAME_MS = 250

// 막대
export const PADDLE_WIDTH = 150
export const PADDLE_HEIGHT = 20
export const PADDLE_BOTTOM_MARGIN = 40
export const PADDLE_SPEED = 900

// 공
export const BALL_RADIUS = 10
export const BALL_BASE_SPEED = 600
export const BALL_LAUNCH_ANGLE_DEG = 45
export const MIN_BOUNCE_ANGLE_DEG = 15
export const PADDLE_MAX_BOUNCE_ANGLE_DEG = 60

// 블록 배치 (그리드 12x8, 상단 좌측 HUD 공간을 위해 위쪽을 비워둔다)
export const BLOCK_AREA_LEFT = 40
export const BLOCK_AREA_TOP = 100
export const BLOCK_WIDTH = 100
export const BLOCK_HEIGHT = 32
export const BLOCK_DRAW_INSET = 2
export const BLOCK_COLORS = ['#ff5d73', '#ff9f43', '#ffd93d', '#6bd96b', '#4dd2ff', '#8c7bff', '#e86bff']

// 아이템
export const ITEM_WIDTH = 40
export const ITEM_HEIGHT = 40
/** 아이템 낙하 속도(px/s). 가속 없이 일정하게 떨어진다. */
export const ITEM_FALL_SPEED = 180

// 아이템 효과
export const BALL_SPEED_BOOST_MULTIPLIER = 2
export const BALL_SPEED_SLOW_MULTIPLIER = 0.5
export const PADDLE_LONG_MULTIPLIER = 2
export const PADDLE_SHORT_MULTIPLIER = 0.5
export const SCORE_BONUS_MULTIPLIER = 2
export const MULTI_BALL_SPREAD_DEG = 20

// 벽 (화면 가장자리 안쪽에 그려지는 좌/우/상단 벽. 공과 막대는 벽 안쪽 영역에서만 움직인다)
export const WALL_THICKNESS = 12
export const PLAY_LEFT = WALL_THICKNESS
export const PLAY_RIGHT = LOGICAL_WIDTH - WALL_THICKNESS
export const PLAY_TOP = WALL_THICKNESS
