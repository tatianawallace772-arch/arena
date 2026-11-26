import type { BlocklyBlockNode } from '../blockly/astTypes';
import type { ProjectModel, SpriteModel } from '../types/studio';
import { BACKDROP_LIBRARY, BUILTIN_SOUNDS, SPRITE_LIBRARY } from './assets';

function numInput(n: number) {
  return { shadow: { type: 'math_number_scratch', fields: { NUM: n } } };
}

function strInput(s: string) {
  return { shadow: { type: 'text_scratch', fields: { TEXT: s } } };
}

function blockInput(b: BlocklyBlockNode) {
  return { block: b };
}

function chain(blocks: BlocklyBlockNode[]): BlocklyBlockNode | undefined {
  if (blocks.length === 0) return undefined;
  for (let i = 0; i < blocks.length - 1; i++) {
    blocks[i].next = { block: blocks[i + 1] };
  }
  return blocks[0];
}

function makeBaseSprite(
  libId: string,
  overrides: Partial<SpriteModel> & { id: string; name?: string }
): SpriteModel {
  const lib = SPRITE_LIBRARY.find((s) => s.id === libId) ?? SPRITE_LIBRARY[0];
  return {
    id: overrides.id,
    name: overrides.name ?? lib.name,
    x: overrides.x ?? 0,
    y: overrides.y ?? 0,
    size: overrides.size ?? lib.defaultSize,
    direction: overrides.direction ?? 90,
    rotationStyle: overrides.rotationStyle ?? 'left-right',
    visible: overrides.visible ?? true,
    draggable: overrides.draggable ?? true,
    layerOrder: overrides.layerOrder ?? 1,
    costumes: lib.costumes.map((c) => ({ ...c })),
    currentCostumeIndex: overrides.currentCostumeIndex ?? 0,
    sounds: lib.defaultSounds.map((s) => ({ ...s })),
    effects: { color: 0, brightness: 0, ghost: 0, fisheye: 0, whirl: 0, pixelate: 0 },
    bubble: null,
    pen: { isDown: false, color: '#7C3AED', size: 4, hue: 265 },
    physics: { vx: 0, vy: 0, gravity: 0, bounce: 0.5 },
    workspaceState: overrides.workspaceState ?? { blocks: { languageVersion: 0, blocks: [] } },
  };
}

export interface ProjectTemplateMeta {
  id: string;
  name: string;
  badge: string;
  description: string;
  build: () => ProjectModel;
}

export function createDefaultProject(): ProjectModel {
  // Gingerbread Star workspace
  const gingerMainHat: BlocklyBlockNode = {
    type: 'event_whenflagclicked',
    x: 26,
    y: 24,
    next: {
      block: chain([
        {
          type: 'data_setvariableto',
          fields: { VARIABLE: 'stars' },
          inputs: { VALUE: numInput(0) },
        },
        {
          type: 'motion_gotoxy',
          inputs: { X: numInput(-65), Y: numInput(-18) },
        },
        {
          type: 'looks_switchcostumeto',
          fields: { COSTUME: 'Peace Pose' },
        },
        {
          type: 'looks_sayforsecs',
          inputs: {
            MESSAGE: strInput('Arrow keys to catch stars, or tap Cast Magic! ✨'),
            SECS: numInput(2),
          },
        },
        {
          type: 'control_forever',
          inputs: {
            SUBSTACK: {
              block: chain([
                {
                  type: 'control_if',
                  inputs: {
                    CONDITION: blockInput({
                      type: 'sensing_keypressed',
                      fields: { KEY_OPTION: 'ArrowRight' },
                    }),
                    SUBSTACK: {
                      block: chain([
                        { type: 'motion_pointindirection', fields: { DIRECTION: 90 } },
                        { type: 'motion_changexby', inputs: { DX: numInput(6) } },
                      ]),
                    },
                  },
                },
                {
                  type: 'control_if',
                  inputs: {
                    CONDITION: blockInput({
                      type: 'sensing_keypressed',
                      fields: { KEY_OPTION: 'ArrowLeft' },
                    }),
                    SUBSTACK: {
                      block: chain([
                        { type: 'motion_pointindirection', fields: { DIRECTION: -90 } },
                        { type: 'motion_changexby', inputs: { DX: numInput(-6) } },
                      ]),
                    },
                  },
                },
                {
                  type: 'control_if',
                  inputs: {
                    CONDITION: blockInput({
                      type: 'sensing_keypressed',
                      fields: { KEY_OPTION: 'ArrowUp' },
                    }),
                    SUBSTACK: {
                      block: { type: 'motion_changeyby', inputs: { DY: numInput(6) } },
                    },
                  },
                },
                {
                  type: 'control_if',
                  inputs: {
                    CONDITION: blockInput({
                      type: 'sensing_keypressed',
                      fields: { KEY_OPTION: 'ArrowDown' },
                    }),
                    SUBSTACK: {
                      block: { type: 'motion_changeyby', inputs: { DY: numInput(-6) } },
                    },
                  },
                },
              ]),
            },
          },
        },
      ]),
    },
  };

  const magicBtnHat: BlocklyBlockNode = {
    type: 'appui_when_clicked',
    x: 455,
    y: 24,
    fields: { WIDGET: 'btn_magic' },
    next: {
      block: chain([
        { type: 'looks_switchcostumeto', fields: { COSTUME: 'Star Wand' } },
        { type: 'sound_play', fields: { SOUND: 'Magic Chime' } },
        { type: 'fx_particles', fields: { KIND: 'stars' }, inputs: { COUNT: numInput(24) } },
        {
          type: 'data_changevariableby',
          fields: { VARIABLE: 'stars' },
          inputs: { VALUE: numInput(1) },
        },
        {
          type: 'looks_sayforsecs',
          inputs: {
            MESSAGE: blockInput({
              type: 'operator_join',
              inputs: {
                STRING1: strInput('Star Magic! ⭐ '),
                STRING2: blockInput({ type: 'data_variable', fields: { VARIABLE: 'stars' } }),
              },
            }),
            SECS: numInput(1.2),
          },
        },
      ]),
    },
  };

  const poseBtnHat: BlocklyBlockNode = {
    type: 'appui_when_clicked',
    x: 455,
    y: 295,
    fields: { WIDGET: 'btn_pose' },
    next: {
      block: chain([
        { type: 'looks_nextcostume' },
        { type: 'sound_play', fields: { SOUND: 'Happy Cheer' } },
        { type: 'fx_particles', fields: { KIND: 'confetti' }, inputs: { COUNT: numInput(16) } },
        { type: 'motion_changeyby', inputs: { DY: numInput(18) } },
        { type: 'control_wait', inputs: { DURATION: numInput(0.15) } },
        { type: 'motion_changeyby', inputs: { DY: numInput(-18) } },
      ]),
    },
  };

  const spaceKeyHat: BlocklyBlockNode = {
    type: 'event_whenkeypressed',
    x: 455,
    y: 545,
    fields: { KEY: ' ' },
    next: {
      block: chain([
        { type: 'looks_nextcostume' },
        { type: 'sound_play', fields: { SOUND: 'Jump Hop' } },
        { type: 'fx_particles', fields: { KIND: 'hearts' }, inputs: { COUNT: numInput(14) } },
      ]),
    },
  };

  // Star Gem workspace
  const starGemHat: BlocklyBlockNode = {
    type: 'event_whenflagclicked',
    x: 32,
    y: 28,
    next: {
      block: chain([
        { type: 'motion_gotoxy', inputs: { X: numInput(105), Y: numInput(25) } },
        {
          type: 'control_forever',
          inputs: {
            SUBSTACK: {
              block: chain([
                { type: 'motion_turnright', inputs: { DEGREES: numInput(3) } },
                {
                  type: 'control_if',
                  inputs: {
                    CONDITION: blockInput({
                      type: 'sensing_touchingobject',
                      fields: { TOUCHINGOBJECTMENU: 'Gingerbread Star' },
                    }),
                    SUBSTACK: {
                      block: chain([
                        { type: 'sound_play', fields: { SOUND: 'Star Coin' } },
                        {
                          type: 'data_changevariableby',
                          fields: { VARIABLE: 'stars' },
                          inputs: { VALUE: numInput(1) },
                        },
                        {
                          type: 'fx_particles',
                          fields: { KIND: 'stars' },
                          inputs: { COUNT: numInput(20) },
                        },
                        { type: 'looks_nextcostume' },
                        { type: 'motion_goto', fields: { TO: '_random_' } },
                      ]),
                    },
                  },
                },
              ]),
            },
          },
        },
      ]),
    },
  };

  const gingerSprite = makeBaseSprite('lib-ginger-star', {
    id: 'sprite-ginger',
    name: 'Gingerbread Star',
    x: -65,
    y: -18,
    size: 34,
    layerOrder: 2,
    workspaceState: {
      blocks: {
        languageVersion: 0,
        blocks: [gingerMainHat, magicBtnHat, poseBtnHat, spaceKeyHat],
      },
    },
  });

  const starSprite = makeBaseSprite('lib-star-gem', {
    id: 'sprite-star-gem',
    name: 'Star Gem',
    x: 105,
    y: 25,
    size: 62,
    rotationStyle: 'all around',
    layerOrder: 1,
    workspaceState: {
      blocks: {
        languageVersion: 0,
        blocks: [starGemHat],
      },
    },
  });

  return {
    version: '1.0.0',
    title: 'Gingerbread Star Quest',
    author: 'BlockCraft Creator',
    description: 'Interactive Scratch + App UI game starring Gingerbread Star!',
    stageMode: 'classic',
    tempo: 120,
    volume: 80,
    backdrops: BACKDROP_LIBRARY.map((b) => ({ ...b })),
    currentBackdropIndex: 0,
    sprites: [gingerSprite, starSprite],
    widgets: [
      {
        id: 'btn_magic',
        type: 'button',
        label: '✨ Cast Magic',
        value: '',
        x: -82,
        y: -146,
        width: 142,
        height: 38,
        color: '#7C3AED',
        textColor: '#FFFFFF',
        fontSize: 13,
        borderRadius: 999,
        visible: true,
      },
      {
        id: 'btn_pose',
        type: 'button',
        label: '🎭 Switch Pose',
        value: '',
        x: 82,
        y: -146,
        width: 142,
        height: 38,
        color: '#EC4899',
        textColor: '#FFFFFF',
        fontSize: 13,
        borderRadius: 999,
        visible: true,
      },
    ],
    variables: [
      {
        id: 'var-stars',
        name: 'stars',
        value: 0,
        visible: true,
        readout: 'normal',
        sliderMin: 0,
        sliderMax: 100,
        x: -175,
        y: 152,
      },
    ],
    lists: [],
  };
}

export function createMobileClickerTemplate(): ProjectModel {
  const tapBtnHat: BlocklyBlockNode = {
    type: 'appui_when_clicked',
    x: 28,
    y: 24,
    fields: { WIDGET: 'btn_bake' },
    next: {
      block: chain([
        { type: 'looks_nextcostume' },
        { type: 'sound_play', fields: { SOUND: 'Bubble Pop' } },
        {
          type: 'data_changevariableby',
          fields: { VARIABLE: 'cookies' },
          inputs: {
            VALUE: blockInput({ type: 'data_variable', fields: { VARIABLE: 'per_tap' } }),
          },
        },
        {
          type: 'appui_set_value',
          fields: { WIDGET: 'bar_goal' },
          inputs: {
            VALUE: blockInput({ type: 'data_variable', fields: { VARIABLE: 'cookies' } }),
          },
        },
        { type: 'fx_particles', fields: { KIND: 'stars' }, inputs: { COUNT: numInput(10) } },
      ]),
    },
  };

  const upgradeHat: BlocklyBlockNode = {
    type: 'appui_when_clicked',
    x: 420,
    y: 24,
    fields: { WIDGET: 'btn_upgrade' },
    next: {
      block: chain([
        {
          type: 'control_if_else',
          inputs: {
            CONDITION: blockInput({
              type: 'operator_gt',
              inputs: {
                OPERAND1: blockInput({ type: 'data_variable', fields: { VARIABLE: 'cookies' } }),
                OPERAND2: numInput(9),
              },
            }),
            SUBSTACK: {
              block: chain([
                {
                  type: 'data_changevariableby',
                  fields: { VARIABLE: 'cookies' },
                  inputs: { VALUE: numInput(-10) },
                },
                {
                  type: 'data_changevariableby',
                  fields: { VARIABLE: 'per_tap' },
                  inputs: { VALUE: numInput(2) },
                },
                { type: 'sound_play', fields: { SOUND: '8-Bit Powerup' } },
                { type: 'looks_switchcostumeto', fields: { COSTUME: 'Happy Cheer' } },
                {
                  type: 'appui_toast',
                  inputs: { MESSAGE: strInput('Magic Wand Upgraded! +2 per tap 🚀') },
                },
                { type: 'fx_particles', fields: { KIND: 'confetti' }, inputs: { COUNT: numInput(28) } },
              ]),
            },
            SUBSTACK2: {
              block: chain([
                { type: 'sound_play', fields: { SOUND: 'Oops Wah' } },
                { type: 'appui_toast', inputs: { MESSAGE: strInput('Need 10 cookies first! 🍪') } },
              ]),
            },
          },
        },
      ]),
    },
  };

  const sprite = makeBaseSprite('lib-ginger-star', {
    id: 'sprite-ginger-app',
    name: 'Gingerbread Star',
    x: 0,
    y: 35,
    size: 40,
    workspaceState: {
      blocks: { languageVersion: 0, blocks: [tapBtnHat, upgradeHat] },
    },
  });

  return {
    version: '1.0.0',
    title: 'Gingerbread Tapper Mobile App',
    author: 'BlockCraft Creator',
    description: 'Smartphone 9:15 app built with Scratch & Blockly App UI widgets!',
    stageMode: 'mobile',
    tempo: 120,
    volume: 80,
    backdrops: BACKDROP_LIBRARY.map((b) => ({ ...b })),
    currentBackdropIndex: 2,
    sprites: [sprite],
    widgets: [
      {
        id: 'lbl_header',
        type: 'label',
        label: '🍪 Star Bakery App',
        value: '',
        x: 0,
        y: 255,
        width: 240,
        height: 36,
        color: '#312E81',
        textColor: '#F8FAFC',
        fontSize: 16,
        borderRadius: 14,
        visible: true,
      },
      {
        id: 'bar_goal',
        type: 'progress',
        label: 'Bakery Goal (100)',
        value: '0',
        max: 100,
        x: 0,
        y: -115,
        width: 270,
        height: 28,
        color: '#10B981',
        textColor: '#FFFFFF',
        fontSize: 12,
        borderRadius: 10,
        visible: true,
      },
      {
        id: 'btn_bake',
        type: 'button',
        label: '✨ Tap to Bake!',
        value: '',
        x: 0,
        y: -175,
        width: 250,
        height: 46,
        color: '#F59E0B',
        textColor: '#1E1B4B',
        fontSize: 15,
        borderRadius: 16,
        visible: true,
      },
      {
        id: 'btn_upgrade',
        type: 'button',
        label: '⚡ Upgrade Wand (10 🍪)',
        value: '',
        x: 0,
        y: -235,
        width: 250,
        height: 42,
        color: '#7C3AED',
        textColor: '#FFFFFF',
        fontSize: 13,
        borderRadius: 14,
        visible: true,
      },
    ],
    variables: [
      {
        id: 'var-cookies',
        name: 'cookies',
        value: 0,
        visible: true,
        readout: 'normal',
        sliderMin: 0,
        sliderMax: 100,
        x: -95,
        y: 205,
      },
      {
        id: 'var-pertap',
        name: 'per_tap',
        value: 1,
        visible: true,
        readout: 'normal',
        sliderMin: 1,
        sliderMax: 50,
        x: 75,
        y: 205,
      },
    ],
    lists: [],
  };
}

export function createSpirographTemplate(): ProjectModel {
  const drawHat: BlocklyBlockNode = {
    type: 'event_whenflagclicked',
    x: 28,
    y: 24,
    next: {
      block: chain([
        { type: 'pen_clear' },
        { type: 'motion_gotoxy', inputs: { X: numInput(-45), Y: numInput(30) } },
        { type: 'pen_setpensizeto', inputs: { SIZE: numInput(3) } },
        { type: 'pen_pendown' },
        {
          type: 'control_repeat',
          inputs: {
            TIMES: numInput(72),
            SUBSTACK: {
              block: chain([
                {
                  type: 'motion_movesteps',
                  inputs: {
                    STEPS: blockInput({ type: 'appui_get_value', fields: { WIDGET: 'sld_size' } }),
                  },
                },
                {
                  type: 'motion_turnright',
                  inputs: {
                    DEGREES: blockInput({ type: 'appui_get_value', fields: { WIDGET: 'sld_angle' } }),
                  },
                },
                { type: 'pen_changepenhueby', inputs: { HUE: numInput(5) } },
              ]),
            },
          },
        },
        { type: 'pen_penup' },
        { type: 'sound_play', fields: { SOUND: 'Magic Chime' } },
      ]),
    },
  };

  const redrawHat: BlocklyBlockNode = {
    type: 'appui_when_clicked',
    x: 425,
    y: 24,
    fields: { WIDGET: 'btn_draw' },
    next: {
      block: chain([
        { type: 'pen_clear' },
        { type: 'motion_gotoxy', inputs: { X: numInput(-45), Y: numInput(30) } },
        { type: 'pen_pendown' },
        {
          type: 'control_repeat',
          inputs: {
            TIMES: numInput(72),
            SUBSTACK: {
              block: chain([
                {
                  type: 'motion_movesteps',
                  inputs: {
                    STEPS: blockInput({ type: 'appui_get_value', fields: { WIDGET: 'sld_size' } }),
                  },
                },
                {
                  type: 'motion_turnright',
                  inputs: {
                    DEGREES: blockInput({ type: 'appui_get_value', fields: { WIDGET: 'sld_angle' } }),
                  },
                },
                { type: 'pen_changepenhueby', inputs: { HUE: numInput(7) } },
              ]),
            },
          },
        },
        { type: 'pen_penup' },
      ]),
    },
  };

  const sprite = makeBaseSprite('lib-ginger-star', {
    id: 'sprite-spiro',
    name: 'Gingerbread Star',
    x: 0,
    y: 0,
    size: 22,
    currentCostumeIndex: 1,
    workspaceState: { blocks: { languageVersion: 0, blocks: [drawHat, redrawHat] } },
  });

  return {
    version: '1.0.0',
    title: 'Neon Spirograph Art Maker',
    author: 'BlockCraft Creator',
    description: 'Interactive generative Pen art app with live App UI sliders!',
    stageMode: 'classic',
    tempo: 120,
    volume: 80,
    backdrops: BACKDROP_LIBRARY.map((b) => ({ ...b })),
    currentBackdropIndex: 2,
    sprites: [sprite],
    widgets: [
      {
        id: 'sld_size',
        type: 'slider',
        label: 'Radius',
        value: '115',
        min: 40,
        max: 170,
        x: -145,
        y: -148,
        width: 155,
        height: 36,
        color: '#22D3EE',
        textColor: '#F8FAFC',
        fontSize: 12,
        borderRadius: 10,
        visible: true,
      },
      {
        id: 'sld_angle',
        type: 'slider',
        label: 'Angle',
        value: '125',
        min: 65,
        max: 175,
        x: 20,
        y: -148,
        width: 155,
        height: 36,
        color: '#F472B6',
        textColor: '#F8FAFC',
        fontSize: 12,
        borderRadius: 10,
        visible: true,
      },
      {
        id: 'btn_draw',
        type: 'button',
        label: '🎨 Paint',
        value: '',
        x: 175,
        y: -148,
        width: 105,
        height: 36,
        color: '#10B981',
        textColor: '#FFFFFF',
        fontSize: 13,
        borderRadius: 10,
        visible: true,
      },
    ],
    variables: [],
    lists: [],
  };
}

export function createQuizVoiceAppTemplate(): ProjectModel {
  const checkHat: BlocklyBlockNode = {
    type: 'appui_when_clicked',
    x: 32,
    y: 28,
    fields: { WIDGET: 'btn_submit' },
    next: {
      block: chain([
        {
          type: 'control_if_else',
          inputs: {
            CONDITION: blockInput({
              type: 'operator_equals',
              inputs: {
                OPERAND1: blockInput({ type: 'appui_get_value', fields: { WIDGET: 'inp_answer' } }),
                OPERAND2: strInput('56'),
              },
            }),
            SUBSTACK: {
              block: chain([
                { type: 'sound_play', fields: { SOUND: 'Victory Fanfare' } },
                {
                  type: 'data_changevariableby',
                  fields: { VARIABLE: 'points' },
                  inputs: { VALUE: numInput(10) },
                },
                { type: 'fx_particles', fields: { KIND: 'confetti' }, inputs: { COUNT: numInput(30) } },
                {
                  type: 'sound_speak',
                  inputs: { TEXT: strInput('Awesome job! 7 times 8 is 56!') },
                },
              ]),
            },
            SUBSTACK2: {
              block: chain([
                { type: 'sound_play', fields: { SOUND: 'Spring Boing' } },
                { type: 'fx_screenshake', inputs: { INTENSITY: numInput(6) } },
                { type: 'looks_sayforsecs', inputs: { MESSAGE: strInput('Hint: try 56! 💡'), SECS: numInput(2) } },
              ]),
            },
          },
        },
      ]),
    },
  };

  const bot = makeBaseSprite('lib-cyber-bot', {
    id: 'sprite-bot',
    name: 'AppBot AI',
    x: 0,
    y: 65,
    size: 95,
    sounds: [...BUILTIN_SOUNDS],
    workspaceState: { blocks: { languageVersion: 0, blocks: [checkHat] } },
  });

  return {
    version: '1.0.0',
    title: 'AI Math & Voice Quiz App',
    author: 'BlockCraft Creator',
    description: 'Interactive mobile quiz app with text inputs and speech synthesis!',
    stageMode: 'mobile',
    tempo: 120,
    volume: 80,
    backdrops: BACKDROP_LIBRARY.map((b) => ({ ...b })),
    currentBackdropIndex: 1,
    sprites: [bot],
    widgets: [
      {
        id: 'card_q',
        type: 'label',
        label: '🤖 What is 7 × 8?',
        value: '',
        x: 0,
        y: -35,
        width: 260,
        height: 44,
        color: '#EEF2FF',
        textColor: '#1E1B4B',
        fontSize: 17,
        borderRadius: 14,
        visible: true,
      },
      {
        id: 'inp_answer',
        type: 'input',
        label: 'Answer',
        value: '',
        placeholder: 'Type your answer...',
        x: 0,
        y: -98,
        width: 240,
        height: 40,
        color: '#FFFFFF',
        textColor: '#0F172A',
        fontSize: 14,
        borderRadius: 12,
        visible: true,
      },
      {
        id: 'btn_submit',
        type: 'button',
        label: '✅ Check Answer (Speak)',
        value: '',
        x: 0,
        y: -158,
        width: 240,
        height: 44,
        color: '#4F46E5',
        textColor: '#FFFFFF',
        fontSize: 14,
        borderRadius: 12,
        visible: true,
      },
    ],
    variables: [
      {
        id: 'var-pts',
        name: 'points',
        value: 0,
        visible: true,
        readout: 'normal',
        sliderMin: 0,
        sliderMax: 100,
        x: -100,
        y: 255,
      },
    ],
    lists: [],
  };
}

export function createBlankProject(): ProjectModel {
  const starterHat: BlocklyBlockNode = {
    type: 'event_whenflagclicked',
    x: 40,
    y: 40,
    next: {
      block: {
        type: 'looks_sayforsecs',
        inputs: {
          MESSAGE: strInput('Ready to build! 🚀'),
          SECS: numInput(2),
        },
      },
    },
  };

  const ginger = makeBaseSprite('lib-ginger-star', {
    id: 'sprite-ginger-blank',
    name: 'Gingerbread Star',
    x: 0,
    y: -10,
    size: 36,
    workspaceState: { blocks: { languageVersion: 0, blocks: [starterHat] } },
  });

  return {
    version: '1.0.0',
    title: 'Untitled Scratch App',
    author: 'BlockCraft Creator',
    description: 'New Scratch + Google Blockly project',
    stageMode: 'classic',
    tempo: 120,
    volume: 80,
    backdrops: BACKDROP_LIBRARY.map((b) => ({ ...b })),
    currentBackdropIndex: 0,
    sprites: [ginger],
    widgets: [],
    variables: [
      {
        id: 'var-myvar',
        name: 'score',
        value: 0,
        visible: false,
        readout: 'normal',
        sliderMin: 0,
        sliderMax: 100,
        x: -175,
        y: 152,
      },
    ],
    lists: [],
  };
}

export function createExtensionsShowcaseTemplate(): ProjectModel {
  const startHat: BlocklyBlockNode = {
    type: 'event_whenflagclicked',
    x: 32,
    y: 28,
    next: {
      block: chain([
        { type: 'motion_gotoxy', inputs: { X: numInput(0), Y: numInput(70) } },
        { type: 'physics_set_gravity', inputs: { GRAVITY: numInput(13) } },
        {
          type: 'physics_set_bounciness',
          inputs: { BOUNCE: numInput(58), FRICTION: numInput(12) },
        },
        { type: 'physics_enable', fields: { MODE: 'dynamic' } },
        { type: 'gamepad_show_virtual', fields: { STATE: 'show' } },
        { type: 'music_setinstrument', fields: { INSTRUMENT: 'marimba' } },
        {
          type: 'looks_sayforsecs',
          inputs: {
            MESSAGE: blockInput({
              type: 'translate_gettext',
              fields: { LANG: 'es' },
              inputs: { WORDS: strInput('hello friend') },
            }),
            SECS: numInput(1.8),
          },
        },
        {
          type: 'control_forever',
          inputs: {
            SUBSTACK: {
              block: chain([
                {
                  type: 'control_if',
                  inputs: {
                    CONDITION: blockInput({
                      type: 'gamepad_button_down',
                      fields: { BUTTON: 'right' },
                    }),
                    SUBSTACK: {
                      block: chain([
                        { type: 'motion_pointindirection', fields: { DIRECTION: 90 } },
                        { type: 'physics_push', inputs: { FX: numInput(1.2), FY: numInput(0) } },
                      ]),
                    },
                  },
                },
                {
                  type: 'control_if',
                  inputs: {
                    CONDITION: blockInput({
                      type: 'gamepad_button_down',
                      fields: { BUTTON: 'left' },
                    }),
                    SUBSTACK: {
                      block: chain([
                        { type: 'motion_pointindirection', fields: { DIRECTION: -90 } },
                        { type: 'physics_push', inputs: { FX: numInput(-1.2), FY: numInput(0) } },
                      ]),
                    },
                  },
                },
              ]),
            },
          },
        },
      ]),
    },
  };

  const jumpPadHat: BlocklyBlockNode = {
    type: 'gamepad_when_button',
    x: 470,
    y: 28,
    fields: { BUTTON: 'A' },
    next: {
      block: chain([
        { type: 'physics_jump', inputs: { POWER: numInput(10.5) } },
        { type: 'looks_nextcostume' },
        { type: 'music_playnote', fields: { NOTE: '67' }, inputs: { BEATS: numInput(0.2) } },
        { type: 'fx_particles', fields: { KIND: 'stars' }, inputs: { COUNT: numInput(16) } },
      ]),
    },
  };

  const beatAndKittenHat: BlocklyBlockNode = {
    type: 'gamepad_when_button',
    x: 470,
    y: 285,
    fields: { BUTTON: 'B' },
    next: {
      block: chain([
        { type: 'music_playdrum', fields: { DRUM: 'snare' }, inputs: { BEATS: numInput(0.2) } },
        { type: 'tts_setvoice', fields: { VOICE: 'kitten' } },
        { type: 'tts_speak', inputs: { TEXT: strInput('super star power') } },
        {
          type: 'data_changevariableby',
          fields: { VARIABLE: 'hops' },
          inputs: { VALUE: numInput(1) },
        },
        {
          type: 'storage_save',
          inputs: {
            VALUE: blockInput({ type: 'data_variable', fields: { VARIABLE: 'hops' } }),
            KEY: strInput('best_hops'),
          },
        },
      ]),
    },
  };

  const ginger = makeBaseSprite('lib-ginger-star', {
    id: 'sprite-ext-ginger',
    name: 'Gingerbread Star',
    x: 0,
    y: 70,
    size: 34,
    workspaceState: {
      blocks: { languageVersion: 0, blocks: [startHat, jumpPadHat, beatAndKittenHat] },
    },
  });

  return {
    version: '1.1.0',
    title: 'Scratch Extensions Arcade Lab',
    author: 'BlockCraft Creator',
    description:
      'Showcases 2D Physics Gravity, Arcade D-Pad, Music Synth, Kitten TTS, Translate & Cloud Save!',
    stageMode: 'classic',
    tempo: 128,
    volume: 85,
    enabledExtensions: [
      'physics',
      'gamepad',
      'music',
      'tts',
      'translate',
      'storage',
      'fx',
      'appui',
    ],
    backdrops: BACKDROP_LIBRARY.map((b) => ({ ...b })),
    currentBackdropIndex: 1,
    sprites: [ginger],
    widgets: [],
    variables: [
      {
        id: 'var-hops',
        name: 'hops',
        value: 0,
        visible: true,
        readout: 'normal',
        sliderMin: 0,
        sliderMax: 100,
        x: -180,
        y: 152,
      },
    ],
    lists: [],
  };
}

export function createChemistMixerLabTemplate(): ProjectModel {
  // ---- Sprite 1: Gingerbread Star (Master Chemist) ----
  const chemistStartHat: BlocklyBlockNode = {
    type: 'event_whenflagclicked',
    x: 28,
    y: 26,
    next: {
      block: chain([
        {
          type: 'data_setvariableto',
          fields: { VARIABLE: 'frost' },
          inputs: { VALUE: numInput(0) },
        },
        {
          type: 'data_setvariableto',
          fields: { VARIABLE: 'berry' },
          inputs: { VALUE: numInput(0) },
        },
        {
          type: 'data_setvariableto',
          fields: { VARIABLE: 'solar' },
          inputs: { VALUE: numInput(0) },
        },
        {
          type: 'data_setvariableto',
          fields: { VARIABLE: 'potions_made' },
          inputs: { VALUE: numInput(0) },
        },
        { type: 'music_setinstrument', fields: { INSTRUMENT: 'marimba' } },
        { type: 'tts_setvoice', fields: { VOICE: 'alto' } },
        { type: 'motion_gotoxy', inputs: { X: numInput(-115), Y: numInput(-2) } },
        { type: 'looks_switchcostumeto', fields: { COSTUME: 'Star Wand' } },
        {
          type: 'appui_set_text',
          fields: { WIDGET: 'lbl_formula' },
          inputs: { TEXT: strInput('🧪 Lab Ready — Add Drops & Click Brew!') },
        },
        {
          type: 'looks_sayforsecs',
          inputs: {
            MESSAGE: strInput('Mix Frost, Berry & Solar drops, adjust Heat, then Brew! 🧪✨'),
            SECS: numInput(2.4),
          },
        },
      ]),
    },
  };

  const totalDropsExpr = (): BlocklyBlockNode => ({
    type: 'operator_add',
    inputs: {
      NUM1: blockInput({
        type: 'operator_add',
        inputs: {
          NUM1: blockInput({ type: 'data_variable', fields: { VARIABLE: 'frost' } }),
          NUM2: blockInput({ type: 'data_variable', fields: { VARIABLE: 'berry' } }),
        },
      }),
      NUM2: blockInput({ type: 'data_variable', fields: { VARIABLE: 'solar' } }),
    },
  });

  const allThreeMixedExpr = (): BlocklyBlockNode => ({
    type: 'operator_and',
    inputs: {
      OPERAND1: blockInput({
        type: 'operator_gt',
        inputs: {
          OPERAND1: blockInput({ type: 'data_variable', fields: { VARIABLE: 'frost' } }),
          OPERAND2: numInput(0),
        },
      }),
      OPERAND2: blockInput({
        type: 'operator_and',
        inputs: {
          OPERAND1: blockInput({
            type: 'operator_gt',
            inputs: {
              OPERAND1: blockInput({ type: 'data_variable', fields: { VARIABLE: 'berry' } }),
              OPERAND2: numInput(0),
            },
          }),
          OPERAND2: blockInput({
            type: 'operator_gt',
            inputs: {
              OPERAND1: blockInput({ type: 'data_variable', fields: { VARIABLE: 'solar' } }),
              OPERAND2: numInput(0),
            },
          }),
        },
      }),
    },
  });

  const brewBtnHat: BlocklyBlockNode = {
    type: 'appui_when_clicked',
    x: 470,
    y: 26,
    fields: { WIDGET: 'btn_brew' },
    next: {
      block: chain([
        { type: 'event_broadcast', fields: { MESSAGE: 'brew_reaction' } },
        {
          type: 'control_if_else',
          inputs: {
            CONDITION: blockInput({
              type: 'operator_equals',
              inputs: {
                OPERAND1: blockInput(totalDropsExpr()),
                OPERAND2: numInput(0),
              },
            }),
            SUBSTACK: {
              block: chain([
                { type: 'sound_play', fields: { SOUND: 'Bubble Pop' } },
                {
                  type: 'looks_sayforsecs',
                  inputs: {
                    MESSAGE: strInput('Add Frost, Berry, or Solar drops first! 🧪'),
                    SECS: numInput(1.8),
                  },
                },
              ]),
            },
            SUBSTACK2: {
              block: {
                type: 'control_if_else',
                inputs: {
                  CONDITION: blockInput({
                    type: 'operator_gt',
                    inputs: {
                      OPERAND1: blockInput({
                        type: 'appui_get_value',
                        fields: { WIDGET: 'sld_heat' },
                      }),
                      OPERAND2: numInput(85),
                    },
                  }),
                  SUBSTACK: {
                    block: chain([
                      { type: 'fx_flash', fields: { COLOR: '#FF6B6B' } },
                      { type: 'fx_screenshake', inputs: { INTENSITY: numInput(14) } },
                      {
                        type: 'music_playdrum',
                        fields: { DRUM: 'crash' },
                        inputs: { BEATS: numInput(0.4) },
                      },
                      { type: 'looks_switchcostumeto', fields: { COSTUME: 'Peace Pose' } },
                      {
                        type: 'appui_set_text',
                        fields: { WIDGET: 'lbl_formula' },
                        inputs: { TEXT: strInput('💥 OVERHEAT KABOOM! Lower Burner Heat!') },
                      },
                      {
                        type: 'tts_speak',
                        inputs: { TEXT: strInput('Kaboom! Too much burner heat!') },
                      },
                      {
                        type: 'data_setvariableto',
                        fields: { VARIABLE: 'frost' },
                        inputs: { VALUE: numInput(0) },
                      },
                      {
                        type: 'data_setvariableto',
                        fields: { VARIABLE: 'berry' },
                        inputs: { VALUE: numInput(0) },
                      },
                      {
                        type: 'data_setvariableto',
                        fields: { VARIABLE: 'solar' },
                        inputs: { VALUE: numInput(0) },
                      },
                    ]),
                  },
                  SUBSTACK2: {
                    block: {
                      type: 'control_if_else',
                      inputs: {
                        CONDITION: blockInput(allThreeMixedExpr()),
                        SUBSTACK: {
                          block: chain([
                            { type: 'looks_switchcostumeto', fields: { COSTUME: 'Happy Cheer' } },
                            { type: 'fx_flash', fields: { COLOR: '#FEF08A' } },
                            { type: 'fx_camera_zoom', inputs: { ZOOM: numInput(116) } },
                            { type: 'sound_play', fields: { SOUND: 'Victory Fanfare' } },
                            {
                              type: 'data_changevariableby',
                              fields: { VARIABLE: 'potions_made' },
                              inputs: { VALUE: numInput(1) },
                            },
                            {
                              type: 'storage_save',
                              inputs: {
                                VALUE: blockInput({
                                  type: 'data_variable',
                                  fields: { VARIABLE: 'potions_made' },
                                }),
                                KEY: strInput('chemist_potions'),
                              },
                            },
                            {
                              type: 'appui_set_text',
                              fields: { WIDGET: 'lbl_formula' },
                              inputs: { TEXT: strInput('🌈 EUREKA! Rainbow Supernova Elixir! ⭐') },
                            },
                            {
                              type: 'appui_toast',
                              inputs: { MESSAGE: strInput('🏆 Legendary Supernova Elixir Brewed!') },
                            },
                            {
                              type: 'tts_speak',
                              inputs: { TEXT: strInput('Eureka! Rainbow Supernova Elixir!') },
                            },
                            { type: 'fx_camera_reset' },
                          ]),
                        },
                        SUBSTACK2: {
                          block: {
                            type: 'control_if_else',
                            inputs: {
                              CONDITION: blockInput({
                                type: 'operator_and',
                                inputs: {
                                  OPERAND1: blockInput({
                                    type: 'operator_gt',
                                    inputs: {
                                      OPERAND1: blockInput({
                                        type: 'data_variable',
                                        fields: { VARIABLE: 'frost' },
                                      }),
                                      OPERAND2: numInput(0),
                                    },
                                  }),
                                  OPERAND2: blockInput({
                                    type: 'operator_gt',
                                    inputs: {
                                      OPERAND1: blockInput({
                                        type: 'data_variable',
                                        fields: { VARIABLE: 'berry' },
                                      }),
                                      OPERAND2: numInput(0),
                                    },
                                  }),
                                },
                              }),
                              SUBSTACK: {
                                block: chain([
                                  {
                                    type: 'looks_switchcostumeto',
                                    fields: { COSTUME: 'Star Wand' },
                                  },
                                  { type: 'sound_play', fields: { SOUND: 'Magic Chime' } },
                                  {
                                    type: 'data_changevariableby',
                                    fields: { VARIABLE: 'potions_made' },
                                    inputs: { VALUE: numInput(1) },
                                  },
                                  {
                                    type: 'appui_set_text',
                                    fields: { WIDGET: 'lbl_formula' },
                                    inputs: {
                                      TEXT: strInput('🔮 Brewed: Anti-Gravity Levitation Serum!'),
                                    },
                                  },
                                  {
                                    type: 'motion_glidesecstoxy',
                                    inputs: {
                                      SECS: numInput(0.45),
                                      X: numInput(-115),
                                      Y: numInput(38),
                                    },
                                  },
                                  {
                                    type: 'tts_speak',
                                    inputs: { TEXT: strInput('Whoa! Anti gravity levitation!') },
                                  },
                                  {
                                    type: 'motion_glidesecstoxy',
                                    inputs: {
                                      SECS: numInput(0.5),
                                      X: numInput(-115),
                                      Y: numInput(-2),
                                    },
                                  },
                                ]),
                              },
                              SUBSTACK2: {
                                block: chain([
                                  {
                                    type: 'looks_switchcostumeto',
                                    fields: { COSTUME: 'Happy Cheer' },
                                  },
                                  { type: 'sound_play', fields: { SOUND: 'Happy Cheer' } },
                                  {
                                    type: 'fx_particles',
                                    fields: { KIND: 'stars' },
                                    inputs: { COUNT: numInput(20) },
                                  },
                                  {
                                    type: 'data_changevariableby',
                                    fields: { VARIABLE: 'potions_made' },
                                    inputs: { VALUE: numInput(1) },
                                  },
                                  {
                                    type: 'appui_set_text',
                                    fields: { WIDGET: 'lbl_formula' },
                                    inputs: {
                                      TEXT: strInput('🌟 Brewed: Sparkling Starlight Tonic!'),
                                    },
                                  },
                                  {
                                    type: 'looks_sayforsecs',
                                    inputs: {
                                      MESSAGE: strInput(
                                        'Sparkling Tonic! Try mixing all 3 reagents together! ✨'
                                      ),
                                      SECS: numInput(2.2),
                                    },
                                  },
                                ]),
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      ]),
    },
  };

  // ---- Sprite 2: Reaction Flask (Bubbling Beaker) ----
  const flaskStartHat: BlocklyBlockNode = {
    type: 'event_whenflagclicked',
    x: 28,
    y: 26,
    next: {
      block: chain([
        { type: 'motion_gotoxy', inputs: { X: numInput(22), Y: numInput(-10) } },
        { type: 'looks_setsizeto', inputs: { SIZE: numInput(94) } },
        { type: 'looks_switchcostumeto', fields: { COSTUME: 'Empty Beaker' } },
      ]),
    },
  };

  const addFrostHat: BlocklyBlockNode = {
    type: 'appui_when_clicked',
    x: 28,
    y: 210,
    fields: { WIDGET: 'btn_frost' },
    next: {
      block: chain([
        {
          type: 'data_changevariableby',
          fields: { VARIABLE: 'frost' },
          inputs: { VALUE: numInput(1) },
        },
        { type: 'looks_switchcostumeto', fields: { COSTUME: 'Frost Cyan Reagent' } },
        { type: 'music_playnote', fields: { NOTE: '64' }, inputs: { BEATS: numInput(0.2) } },
        { type: 'fx_particles', fields: { KIND: 'snow' }, inputs: { COUNT: numInput(14) } },
        {
          type: 'appui_set_text',
          fields: { WIDGET: 'lbl_formula' },
          inputs: {
            TEXT: blockInput({
              type: 'operator_join',
              inputs: {
                STRING1: strInput('💧 Added Frost Reagent! Drops: '),
                STRING2: blockInput({ type: 'data_variable', fields: { VARIABLE: 'frost' } }),
              },
            }),
          },
        },
      ]),
    },
  };

  const addBerryHat: BlocklyBlockNode = {
    type: 'appui_when_clicked',
    x: 430,
    y: 26,
    fields: { WIDGET: 'btn_berry' },
    next: {
      block: chain([
        {
          type: 'data_changevariableby',
          fields: { VARIABLE: 'berry' },
          inputs: { VALUE: numInput(1) },
        },
        { type: 'looks_switchcostumeto', fields: { COSTUME: 'Starberry Magenta' } },
        { type: 'music_playnote', fields: { NOTE: '67' }, inputs: { BEATS: numInput(0.2) } },
        { type: 'fx_particles', fields: { KIND: 'hearts' }, inputs: { COUNT: numInput(14) } },
        {
          type: 'appui_set_text',
          fields: { WIDGET: 'lbl_formula' },
          inputs: {
            TEXT: blockInput({
              type: 'operator_join',
              inputs: {
                STRING1: strInput('🌸 Added Starberry Elixir! Drops: '),
                STRING2: blockInput({ type: 'data_variable', fields: { VARIABLE: 'berry' } }),
              },
            }),
          },
        },
      ]),
    },
  };

  const addSolarHat: BlocklyBlockNode = {
    type: 'appui_when_clicked',
    x: 430,
    y: 265,
    fields: { WIDGET: 'btn_solar' },
    next: {
      block: chain([
        {
          type: 'data_changevariableby',
          fields: { VARIABLE: 'solar' },
          inputs: { VALUE: numInput(1) },
        },
        { type: 'looks_switchcostumeto', fields: { COSTUME: 'Solar Gold Catalyst' } },
        { type: 'music_playnote', fields: { NOTE: '72' }, inputs: { BEATS: numInput(0.2) } },
        { type: 'fx_particles', fields: { KIND: 'stars' }, inputs: { COUNT: numInput(16) } },
        {
          type: 'appui_set_text',
          fields: { WIDGET: 'lbl_formula' },
          inputs: {
            TEXT: blockInput({
              type: 'operator_join',
              inputs: {
                STRING1: strInput('⚡ Added Solar Catalyst! Drops: '),
                STRING2: blockInput({ type: 'data_variable', fields: { VARIABLE: 'solar' } }),
              },
            }),
          },
        },
      ]),
    },
  };

  const rinseHat: BlocklyBlockNode = {
    type: 'appui_when_clicked',
    x: 28,
    y: 470,
    fields: { WIDGET: 'btn_rinse' },
    next: {
      block: chain([
        {
          type: 'data_setvariableto',
          fields: { VARIABLE: 'frost' },
          inputs: { VALUE: numInput(0) },
        },
        {
          type: 'data_setvariableto',
          fields: { VARIABLE: 'berry' },
          inputs: { VALUE: numInput(0) },
        },
        {
          type: 'data_setvariableto',
          fields: { VARIABLE: 'solar' },
          inputs: { VALUE: numInput(0) },
        },
        { type: 'looks_switchcostumeto', fields: { COSTUME: 'Empty Beaker' } },
        { type: 'fx_camera_reset' },
        { type: 'sound_play', fields: { SOUND: 'Bubble Pop' } },
        {
          type: 'appui_set_text',
          fields: { WIDGET: 'lbl_formula' },
          inputs: { TEXT: strInput('🧼 Beaker Rinsed — Ready for Next Formula!') },
        },
      ]),
    },
  };

  const flaskBrewBroadcastHat: BlocklyBlockNode = {
    type: 'event_whenbroadcastreceived',
    x: 430,
    y: 505,
    fields: { MESSAGE: 'brew_reaction' },
    next: {
      block: {
        type: 'control_if_else',
        inputs: {
          CONDITION: blockInput({
            type: 'operator_gt',
            inputs: {
              OPERAND1: blockInput({ type: 'appui_get_value', fields: { WIDGET: 'sld_heat' } }),
              OPERAND2: numInput(85),
            },
          }),
          SUBSTACK: {
            block: chain([
              { type: 'looks_switchcostumeto', fields: { COSTUME: 'Empty Beaker' } },
              { type: 'fx_particles', fields: { KIND: 'fire' }, inputs: { COUNT: numInput(36) } },
            ]),
          },
          SUBSTACK2: {
            block: {
              type: 'control_if_else',
              inputs: {
                CONDITION: blockInput(allThreeMixedExpr()),
                SUBSTACK: {
                  block: chain([
                    {
                      type: 'looks_switchcostumeto',
                      fields: { COSTUME: 'Rainbow Supernova Elixir' },
                    },
                    {
                      type: 'fx_particles',
                      fields: { KIND: 'confetti' },
                      inputs: { COUNT: numInput(34) },
                    },
                    {
                      type: 'fx_particles',
                      fields: { KIND: 'magic' },
                      inputs: { COUNT: numInput(24) },
                    },
                  ]),
                },
                SUBSTACK2: {
                  block: {
                    type: 'fx_particles',
                    fields: { KIND: 'magic' },
                    inputs: { COUNT: numInput(20) },
                  },
                },
              },
            },
          },
        },
      },
    },
  };

  const gingerChemist = makeBaseSprite('lib-ginger-star', {
    id: 'sprite-chemist-ginger',
    name: 'Gingerbread Star',
    x: -115,
    y: -2,
    size: 33,
    currentCostumeIndex: 1,
    layerOrder: 2,
    workspaceState: {
      blocks: { languageVersion: 0, blocks: [chemistStartHat, brewBtnHat] },
    },
  });

  const reactionFlask = makeBaseSprite('lib-potion-flask', {
    id: 'sprite-reaction-flask',
    name: 'Reaction Flask',
    x: 22,
    y: -10,
    size: 94,
    rotationStyle: 'all around',
    layerOrder: 3,
    workspaceState: {
      blocks: {
        languageVersion: 0,
        blocks: [flaskStartHat, addFrostHat, addBerryHat, addSolarHat, rinseHat, flaskBrewBroadcastHat],
      },
    },
  });

  const labBackdropIdx = Math.max(
    0,
    BACKDROP_LIBRARY.findIndex((b) => b.id === 'bg-chemist-lab')
  );

  return {
    version: '1.1.0',
    title: "Gingerbread Star's Chemist Mixer Lab",
    author: 'BlockCraft Creator',
    description:
      'Mix Frost, Starberry & Solar reagents in the Reaction Flask, tune Burner Heat, and discover magical potions!',
    stageMode: 'classic',
    tempo: 124,
    volume: 85,
    enabledExtensions: ['appui', 'fx', 'music', 'tts', 'storage'],
    backdrops: BACKDROP_LIBRARY.map((b) => ({ ...b })),
    currentBackdropIndex: labBackdropIdx,
    sprites: [gingerChemist, reactionFlask],
    widgets: [
      {
        id: 'lbl_formula',
        type: 'label',
        label: '🧪 Lab Ready — Add Drops & Click Brew!',
        value: '',
        x: 34,
        y: 152,
        width: 310,
        height: 30,
        color: '#0F172A',
        textColor: '#67E8F9',
        fontSize: 12,
        borderRadius: 10,
        visible: true,
      },
      {
        id: 'sld_heat',
        type: 'slider',
        label: '🔥 Burner Heat',
        value: '55',
        min: 0,
        max: 100,
        x: 156,
        y: 86,
        width: 138,
        height: 36,
        color: '#F97316',
        textColor: '#FFFFFF',
        fontSize: 11,
        borderRadius: 10,
        visible: true,
      },
      {
        id: 'btn_rinse',
        type: 'button',
        label: '🧼 Rinse Flask',
        value: '',
        x: 156,
        y: 30,
        width: 122,
        height: 32,
        color: '#475569',
        textColor: '#F8FAFC',
        fontSize: 12,
        borderRadius: 10,
        visible: true,
      },
      {
        id: 'btn_frost',
        type: 'button',
        label: '💧 + Frost',
        value: '',
        x: -168,
        y: -148,
        width: 104,
        height: 36,
        color: '#0891B2',
        textColor: '#FFFFFF',
        fontSize: 12,
        borderRadius: 11,
        visible: true,
      },
      {
        id: 'btn_berry',
        type: 'button',
        label: '🌸 + Berry',
        value: '',
        x: -56,
        y: -148,
        width: 104,
        height: 36,
        color: '#DB2777',
        textColor: '#FFFFFF',
        fontSize: 12,
        borderRadius: 11,
        visible: true,
      },
      {
        id: 'btn_solar',
        type: 'button',
        label: '⚡ + Solar',
        value: '',
        x: 56,
        y: -148,
        width: 104,
        height: 36,
        color: '#D97706',
        textColor: '#FFFFFF',
        fontSize: 12,
        borderRadius: 11,
        visible: true,
      },
      {
        id: 'btn_brew',
        type: 'button',
        label: '⚗️ Brew!',
        value: '',
        x: 168,
        y: -148,
        width: 104,
        height: 36,
        color: '#059669',
        textColor: '#FFFFFF',
        fontSize: 13,
        borderRadius: 11,
        visible: true,
      },
    ],
    variables: [
      {
        id: 'var-potions-made',
        name: 'potions_made',
        value: 0,
        visible: true,
        readout: 'normal',
        sliderMin: 0,
        sliderMax: 100,
        x: -228,
        y: 156,
      },
      {
        id: 'var-frost',
        name: 'frost',
        value: 0,
        visible: false,
        readout: 'normal',
        sliderMin: 0,
        sliderMax: 50,
        x: -228,
        y: 124,
      },
      {
        id: 'var-berry',
        name: 'berry',
        value: 0,
        visible: false,
        readout: 'normal',
        sliderMin: 0,
        sliderMax: 50,
        x: -228,
        y: 94,
      },
      {
        id: 'var-solar',
        name: 'solar',
        value: 0,
        visible: false,
        readout: 'normal',
        sliderMin: 0,
        sliderMax: 50,
        x: -228,
        y: 64,
      },
    ],
    lists: [],
  };
}

export function createGingerbreadCalculatorTemplate(): ProjectModel {
  const SCALE_NOTES = ['60', '62', '64', '65', '67', '69', '71', '72', '74', '76'];

  const startHat: BlocklyBlockNode = {
    type: 'event_whenflagclicked',
    x: 28,
    y: 24,
    next: {
      block: chain([
        {
          type: 'data_setvariableto',
          fields: { VARIABLE: 'display' },
          inputs: { VALUE: strInput('0') },
        },
        {
          type: 'data_setvariableto',
          fields: { VARIABLE: 'first_num' },
          inputs: { VALUE: numInput(0) },
        },
        {
          type: 'data_setvariableto',
          fields: { VARIABLE: 'op' },
          inputs: { VALUE: strInput('none') },
        },
        {
          type: 'data_setvariableto',
          fields: { VARIABLE: 'fresh_entry' },
          inputs: { VALUE: numInput(1) },
        },
        {
          type: 'data_setvariableto',
          fields: { VARIABLE: 'solved' },
          inputs: { VALUE: numInput(0) },
        },
        { type: 'music_setinstrument', fields: { INSTRUMENT: 'marimba' } },
        { type: 'tts_setvoice', fields: { VOICE: 'alto' } },
        { type: 'motion_gotoxy', inputs: { X: numInput(-106), Y: numInput(204) } },
        { type: 'looks_switchcostumeto', fields: { COSTUME: 'Peace Pose' } },
        {
          type: 'appui_set_text',
          fields: { WIDGET: 'lbl_screen' },
          inputs: { TEXT: strInput('0') },
        },
        {
          type: 'appui_set_text',
          fields: { WIDGET: 'lbl_tape' },
          inputs: { TEXT: strInput('🍪 Gingerbread Calculator') },
        },
      ]),
    },
  };

  const makeDigitHat = (digit: number, bx: number, by: number): BlocklyBlockNode => ({
    type: 'appui_when_clicked',
    x: bx,
    y: by,
    fields: { WIDGET: `btn_${digit}` },
    next: {
      block: chain([
        {
          type: 'music_playnote',
          fields: { NOTE: SCALE_NOTES[digit] ?? '60' },
          inputs: { BEATS: numInput(0.1) },
        },
        {
          type: 'control_if_else',
          inputs: {
            CONDITION: blockInput({
              type: 'operator_equals',
              inputs: {
                OPERAND1: blockInput({ type: 'data_variable', fields: { VARIABLE: 'fresh_entry' } }),
                OPERAND2: numInput(1),
              },
            }),
            SUBSTACK: {
              block:
                digit === 0
                  ? {
                      type: 'data_setvariableto',
                      fields: { VARIABLE: 'display' },
                      inputs: { VALUE: strInput('0') },
                    }
                  : chain([
                      {
                        type: 'data_setvariableto',
                        fields: { VARIABLE: 'display' },
                        inputs: { VALUE: strInput(String(digit)) },
                      },
                      {
                        type: 'data_setvariableto',
                        fields: { VARIABLE: 'fresh_entry' },
                        inputs: { VALUE: numInput(0) },
                      },
                    ]),
            },
            SUBSTACK2: {
              block: {
                type: 'data_setvariableto',
                fields: { VARIABLE: 'display' },
                inputs: {
                  VALUE: blockInput({
                    type: 'operator_join',
                    inputs: {
                      STRING1: blockInput({
                        type: 'data_variable',
                        fields: { VARIABLE: 'display' },
                      }),
                      STRING2: strInput(String(digit)),
                    },
                  }),
                },
              },
            },
          },
        },
        {
          type: 'appui_set_text',
          fields: { WIDGET: 'lbl_screen' },
          inputs: {
            TEXT: blockInput({ type: 'data_variable', fields: { VARIABLE: 'display' } }),
          },
        },
      ]),
    },
  });

  const dotHat: BlocklyBlockNode = {
    type: 'appui_when_clicked',
    x: 460,
    y: 1220,
    fields: { WIDGET: 'btn_dot' },
    next: {
      block: chain([
        { type: 'sound_play', fields: { SOUND: 'UI Tap' } },
        {
          type: 'control_if_else',
          inputs: {
            CONDITION: blockInput({
              type: 'operator_equals',
              inputs: {
                OPERAND1: blockInput({ type: 'data_variable', fields: { VARIABLE: 'fresh_entry' } }),
                OPERAND2: numInput(1),
              },
            }),
            SUBSTACK: {
              block: chain([
                {
                  type: 'data_setvariableto',
                  fields: { VARIABLE: 'display' },
                  inputs: { VALUE: strInput('0.') },
                },
                {
                  type: 'data_setvariableto',
                  fields: { VARIABLE: 'fresh_entry' },
                  inputs: { VALUE: numInput(0) },
                },
              ]),
            },
            SUBSTACK2: {
              block: {
                type: 'data_setvariableto',
                fields: { VARIABLE: 'display' },
                inputs: {
                  VALUE: blockInput({
                    type: 'operator_join',
                    inputs: {
                      STRING1: blockInput({
                        type: 'data_variable',
                        fields: { VARIABLE: 'display' },
                      }),
                      STRING2: strInput('.'),
                    },
                  }),
                },
              },
            },
          },
        },
        {
          type: 'appui_set_text',
          fields: { WIDGET: 'lbl_screen' },
          inputs: {
            TEXT: blockInput({ type: 'data_variable', fields: { VARIABLE: 'display' } }),
          },
        },
      ]),
    },
  };

  const makeOpHat = (
    btnId: string,
    opCode: 'add' | 'sub' | 'mul' | 'div',
    symbol: string,
    bx: number,
    by: number
  ): BlocklyBlockNode => ({
    type: 'appui_when_clicked',
    x: bx,
    y: by,
    fields: { WIDGET: btnId },
    next: {
      block: chain([
        { type: 'sound_play', fields: { SOUND: 'UI Tap' } },
        { type: 'looks_switchcostumeto', fields: { COSTUME: 'Star Wand' } },
        {
          type: 'data_setvariableto',
          fields: { VARIABLE: 'first_num' },
          inputs: {
            VALUE: blockInput({ type: 'data_variable', fields: { VARIABLE: 'display' } }),
          },
        },
        {
          type: 'data_setvariableto',
          fields: { VARIABLE: 'op' },
          inputs: { VALUE: strInput(opCode) },
        },
        {
          type: 'data_setvariableto',
          fields: { VARIABLE: 'fresh_entry' },
          inputs: { VALUE: numInput(1) },
        },
        {
          type: 'appui_set_text',
          fields: { WIDGET: 'lbl_tape' },
          inputs: {
            TEXT: blockInput({
              type: 'operator_join',
              inputs: {
                STRING1: blockInput({ type: 'data_variable', fields: { VARIABLE: 'first_num' } }),
                STRING2: strInput(` ${symbol} `),
              },
            }),
          },
        },
      ]),
    },
  });

  const clearHat: BlocklyBlockNode = {
    type: 'appui_when_clicked',
    x: 28,
    y: 410,
    fields: { WIDGET: 'btn_clear' },
    next: {
      block: chain([
        { type: 'sound_play', fields: { SOUND: 'Bubble Pop' } },
        {
          type: 'data_setvariableto',
          fields: { VARIABLE: 'display' },
          inputs: { VALUE: strInput('0') },
        },
        {
          type: 'data_setvariableto',
          fields: { VARIABLE: 'first_num' },
          inputs: { VALUE: numInput(0) },
        },
        {
          type: 'data_setvariableto',
          fields: { VARIABLE: 'op' },
          inputs: { VALUE: strInput('none') },
        },
        {
          type: 'data_setvariableto',
          fields: { VARIABLE: 'fresh_entry' },
          inputs: { VALUE: numInput(1) },
        },
        { type: 'looks_switchcostumeto', fields: { COSTUME: 'Peace Pose' } },
        { type: 'looks_say', inputs: { MESSAGE: strInput('') } },
        {
          type: 'appui_set_text',
          fields: { WIDGET: 'lbl_screen' },
          inputs: { TEXT: strInput('0') },
        },
        {
          type: 'appui_set_text',
          fields: { WIDGET: 'lbl_tape' },
          inputs: { TEXT: strInput('🍪 Cleared — Ready!') },
        },
      ]),
    },
  };

  const signHat: BlocklyBlockNode = {
    type: 'appui_when_clicked',
    x: 28,
    y: 740,
    fields: { WIDGET: 'btn_sign' },
    next: {
      block: chain([
        { type: 'sound_play', fields: { SOUND: 'UI Tap' } },
        {
          type: 'data_setvariableto',
          fields: { VARIABLE: 'display' },
          inputs: {
            VALUE: blockInput({
              type: 'operator_subtract',
              inputs: {
                NUM1: numInput(0),
                NUM2: blockInput({ type: 'data_variable', fields: { VARIABLE: 'display' } }),
              },
            }),
          },
        },
        {
          type: 'appui_set_text',
          fields: { WIDGET: 'lbl_screen' },
          inputs: {
            TEXT: blockInput({ type: 'data_variable', fields: { VARIABLE: 'display' } }),
          },
        },
      ]),
    },
  };

  const squareHat: BlocklyBlockNode = {
    type: 'appui_when_clicked',
    x: 28,
    y: 940,
    fields: { WIDGET: 'btn_sq' },
    next: {
      block: chain([
        { type: 'looks_switchcostumeto', fields: { COSTUME: 'Star Wand' } },
        { type: 'sound_play', fields: { SOUND: 'Magic Chime' } },
        {
          type: 'appui_set_text',
          fields: { WIDGET: 'lbl_tape' },
          inputs: {
            TEXT: blockInput({
              type: 'operator_join',
              inputs: {
                STRING1: blockInput({ type: 'data_variable', fields: { VARIABLE: 'display' } }),
                STRING2: strInput('² ='),
              },
            }),
          },
        },
        {
          type: 'data_setvariableto',
          fields: { VARIABLE: 'display' },
          inputs: {
            VALUE: blockInput({
              type: 'operator_multiply',
              inputs: {
                NUM1: blockInput({ type: 'data_variable', fields: { VARIABLE: 'display' } }),
                NUM2: blockInput({ type: 'data_variable', fields: { VARIABLE: 'display' } }),
              },
            }),
          },
        },
        {
          type: 'data_setvariableto',
          fields: { VARIABLE: 'fresh_entry' },
          inputs: { VALUE: numInput(1) },
        },
        {
          type: 'data_changevariableby',
          fields: { VARIABLE: 'solved' },
          inputs: { VALUE: numInput(1) },
        },
        { type: 'fx_particles', fields: { KIND: 'stars' }, inputs: { COUNT: numInput(16) } },
        {
          type: 'appui_set_text',
          fields: { WIDGET: 'lbl_screen' },
          inputs: {
            TEXT: blockInput({ type: 'data_variable', fields: { VARIABLE: 'display' } }),
          },
        },
      ]),
    },
  };

  const equalsHat: BlocklyBlockNode = {
    type: 'appui_when_clicked',
    x: 920,
    y: 24,
    fields: { WIDGET: 'btn_eq' },
    next: {
      block: chain([
        {
          type: 'control_if_else',
          inputs: {
            CONDITION: blockInput({
              type: 'operator_and',
              inputs: {
                OPERAND1: blockInput({
                  type: 'operator_equals',
                  inputs: {
                    OPERAND1: blockInput({ type: 'data_variable', fields: { VARIABLE: 'op' } }),
                    OPERAND2: strInput('div'),
                  },
                }),
                OPERAND2: blockInput({
                  type: 'operator_equals',
                  inputs: {
                    OPERAND1: blockInput({
                      type: 'data_variable',
                      fields: { VARIABLE: 'display' },
                    }),
                    OPERAND2: numInput(0),
                  },
                }),
              },
            }),
            SUBSTACK: {
              block: chain([
                { type: 'sound_play', fields: { SOUND: 'Oops Wah' } },
                { type: 'fx_screenshake', inputs: { INTENSITY: numInput(8) } },
                {
                  type: 'appui_set_text',
                  fields: { WIDGET: 'lbl_screen' },
                  inputs: { TEXT: strInput('Div by 0! 🍪') },
                },
                {
                  type: 'appui_set_text',
                  fields: { WIDGET: 'lbl_tape' },
                  inputs: { TEXT: strInput('⚠️ Cannot divide cookies by 0!') },
                },
                {
                  type: 'data_setvariableto',
                  fields: { VARIABLE: 'display' },
                  inputs: { VALUE: strInput('0') },
                },
                {
                  type: 'data_setvariableto',
                  fields: { VARIABLE: 'op' },
                  inputs: { VALUE: strInput('none') },
                },
                {
                  type: 'data_setvariableto',
                  fields: { VARIABLE: 'fresh_entry' },
                  inputs: { VALUE: numInput(1) },
                },
              ]),
            },
            SUBSTACK2: {
              block: chain([
                {
                  type: 'control_if',
                  inputs: {
                    CONDITION: blockInput({
                      type: 'operator_equals',
                      inputs: {
                        OPERAND1: blockInput({
                          type: 'data_variable',
                          fields: { VARIABLE: 'op' },
                        }),
                        OPERAND2: strInput('add'),
                      },
                    }),
                    SUBSTACK: {
                      block: {
                        type: 'data_setvariableto',
                        fields: { VARIABLE: 'display' },
                        inputs: {
                          VALUE: blockInput({
                            type: 'operator_add',
                            inputs: {
                              NUM1: blockInput({
                                type: 'data_variable',
                                fields: { VARIABLE: 'first_num' },
                              }),
                              NUM2: blockInput({
                                type: 'data_variable',
                                fields: { VARIABLE: 'display' },
                              }),
                            },
                          }),
                        },
                      },
                    },
                  },
                },
                {
                  type: 'control_if',
                  inputs: {
                    CONDITION: blockInput({
                      type: 'operator_equals',
                      inputs: {
                        OPERAND1: blockInput({
                          type: 'data_variable',
                          fields: { VARIABLE: 'op' },
                        }),
                        OPERAND2: strInput('sub'),
                      },
                    }),
                    SUBSTACK: {
                      block: {
                        type: 'data_setvariableto',
                        fields: { VARIABLE: 'display' },
                        inputs: {
                          VALUE: blockInput({
                            type: 'operator_subtract',
                            inputs: {
                              NUM1: blockInput({
                                type: 'data_variable',
                                fields: { VARIABLE: 'first_num' },
                              }),
                              NUM2: blockInput({
                                type: 'data_variable',
                                fields: { VARIABLE: 'display' },
                              }),
                            },
                          }),
                        },
                      },
                    },
                  },
                },
                {
                  type: 'control_if',
                  inputs: {
                    CONDITION: blockInput({
                      type: 'operator_equals',
                      inputs: {
                        OPERAND1: blockInput({
                          type: 'data_variable',
                          fields: { VARIABLE: 'op' },
                        }),
                        OPERAND2: strInput('mul'),
                      },
                    }),
                    SUBSTACK: {
                      block: {
                        type: 'data_setvariableto',
                        fields: { VARIABLE: 'display' },
                        inputs: {
                          VALUE: blockInput({
                            type: 'operator_multiply',
                            inputs: {
                              NUM1: blockInput({
                                type: 'data_variable',
                                fields: { VARIABLE: 'first_num' },
                              }),
                              NUM2: blockInput({
                                type: 'data_variable',
                                fields: { VARIABLE: 'display' },
                              }),
                            },
                          }),
                        },
                      },
                    },
                  },
                },
                {
                  type: 'control_if',
                  inputs: {
                    CONDITION: blockInput({
                      type: 'operator_equals',
                      inputs: {
                        OPERAND1: blockInput({
                          type: 'data_variable',
                          fields: { VARIABLE: 'op' },
                        }),
                        OPERAND2: strInput('div'),
                      },
                    }),
                    SUBSTACK: {
                      block: {
                        type: 'data_setvariableto',
                        fields: { VARIABLE: 'display' },
                        inputs: {
                          VALUE: blockInput({
                            type: 'operator_divide',
                            inputs: {
                              NUM1: blockInput({
                                type: 'data_variable',
                                fields: { VARIABLE: 'first_num' },
                              }),
                              NUM2: blockInput({
                                type: 'data_variable',
                                fields: { VARIABLE: 'display' },
                              }),
                            },
                          }),
                        },
                      },
                    },
                  },
                },
                {
                  type: 'data_setvariableto',
                  fields: { VARIABLE: 'op' },
                  inputs: { VALUE: strInput('none') },
                },
                {
                  type: 'data_setvariableto',
                  fields: { VARIABLE: 'fresh_entry' },
                  inputs: { VALUE: numInput(1) },
                },
                {
                  type: 'data_changevariableby',
                  fields: { VARIABLE: 'solved' },
                  inputs: { VALUE: numInput(1) },
                },
                {
                  type: 'storage_save',
                  inputs: {
                    VALUE: blockInput({ type: 'data_variable', fields: { VARIABLE: 'solved' } }),
                    KEY: strInput('ginger_calc_solved'),
                  },
                },
                { type: 'looks_switchcostumeto', fields: { COSTUME: 'Happy Cheer' } },
                { type: 'sound_play', fields: { SOUND: 'Star Coin' } },
                {
                  type: 'fx_particles',
                  fields: { KIND: 'stars' },
                  inputs: { COUNT: numInput(20) },
                },
                {
                  type: 'appui_set_text',
                  fields: { WIDGET: 'lbl_screen' },
                  inputs: {
                    TEXT: blockInput({ type: 'data_variable', fields: { VARIABLE: 'display' } }),
                  },
                },
                {
                  type: 'appui_set_text',
                  fields: { WIDGET: 'lbl_tape' },
                  inputs: {
                    TEXT: blockInput({
                      type: 'operator_join',
                      inputs: {
                        STRING1: strInput('⭐ Result = '),
                        STRING2: blockInput({
                          type: 'data_variable',
                          fields: { VARIABLE: 'display' },
                        }),
                      },
                    }),
                  },
                },
              ]),
            },
          },
        },
      ]),
    },
  };

  const speakAnswerHat: BlocklyBlockNode = {
    type: 'appui_when_clicked',
    x: 920,
    y: 960,
    fields: { WIDGET: 'btn_speak' },
    next: {
      block: chain([
        { type: 'looks_switchcostumeto', fields: { COSTUME: 'Happy Cheer' } },
        { type: 'tts_setvoice', fields: { VOICE: 'alto' } },
        {
          type: 'tts_speak',
          inputs: {
            TEXT: blockInput({
              type: 'operator_join',
              inputs: {
                STRING1: strInput('The answer is '),
                STRING2: blockInput({ type: 'data_variable', fields: { VARIABLE: 'display' } }),
              },
            }),
          },
        },
      ]),
    },
  };

  const kittenAnswerHat: BlocklyBlockNode = {
    type: 'appui_when_clicked',
    x: 920,
    y: 1170,
    fields: { WIDGET: 'btn_kitten' },
    next: {
      block: chain([
        { type: 'looks_switchcostumeto', fields: { COSTUME: 'Peace Pose' } },
        { type: 'fx_particles', fields: { KIND: 'hearts' }, inputs: { COUNT: numInput(14) } },
        { type: 'tts_setvoice', fields: { VOICE: 'kitten' } },
        {
          type: 'tts_speak',
          inputs: {
            TEXT: blockInput({
              type: 'operator_join',
              inputs: {
                STRING1: strInput('cookie answer '),
                STRING2: blockInput({ type: 'data_variable', fields: { VARIABLE: 'display' } }),
              },
            }),
          },
        },
      ]),
    },
  };

  const digitBlocks = Array.from({ length: 10 }, (_, d) =>
    makeDigitHat(d, 460, 24 + d * 118)
  );

  const opBlocks = [
    makeOpHat('btn_add', 'add', '+', 1420, 24),
    makeOpHat('btn_sub', 'sub', '−', 1420, 260),
    makeOpHat('btn_mul', 'mul', '×', 1420, 496),
    makeOpHat('btn_div', 'div', '÷', 1420, 732),
  ];

  const gingerCalcSprite = makeBaseSprite('lib-ginger-star', {
    id: 'sprite-ginger-calc',
    name: 'Gingerbread Star',
    x: -106,
    y: 204,
    size: 25,
    currentCostumeIndex: 0,
    layerOrder: 2,
    workspaceState: {
      blocks: {
        languageVersion: 0,
        blocks: [
          startHat,
          clearHat,
          signHat,
          squareHat,
          ...digitBlocks,
          dotHat,
          equalsHat,
          speakAnswerHat,
          kittenAnswerHat,
          ...opBlocks,
        ],
      },
    },
  });

  const calcBackdropIdx = Math.max(
    0,
    BACKDROP_LIBRARY.findIndex((b) => b.id === 'bg-gingerbread-calc')
  );

  const makeKeyBtn = (
    id: string,
    label: string,
    x: number,
    y: number,
    color = '#FFFBEB',
    textColor = '#451A03',
    width = 72,
    height = 46,
    fontSize = 16
  ) => ({
    id,
    type: 'button' as const,
    label,
    value: '',
    x,
    y,
    width,
    height,
    color,
    textColor,
    fontSize,
    borderRadius: 13,
    visible: true,
  });

  return {
    version: '1.1.0',
    title: "Gingerbread Star's Gingerbread Calculator",
    author: 'BlockCraft Creator',
    description:
      'Cozy Gingerbread Smartphone Calculator with decimal math, x² star power, Cloud Save & Kitten/Alto voice readout!',
    stageMode: 'mobile',
    tempo: 132,
    volume: 85,
    enabledExtensions: ['appui', 'fx', 'music', 'tts', 'storage'],
    backdrops: BACKDROP_LIBRARY.map((b) => ({ ...b })),
    currentBackdropIndex: calcBackdropIdx,
    sprites: [gingerCalcSprite],
    widgets: [
      {
        id: 'lbl_screen',
        type: 'label',
        label: '0',
        value: '',
        x: 42,
        y: 218,
        width: 192,
        height: 48,
        color: '#291509',
        textColor: '#6EE7B7',
        fontSize: 22,
        borderRadius: 14,
        visible: true,
      },
      {
        id: 'lbl_tape',
        type: 'label',
        label: '🍪 Gingerbread Calculator',
        value: '',
        x: 42,
        y: 172,
        width: 192,
        height: 26,
        color: '#451A03',
        textColor: '#FDE68A',
        fontSize: 11,
        borderRadius: 9,
        visible: true,
      },
      // Row 1: Utility & Operators
      makeKeyBtn('btn_clear', 'AC', -120, 108, '#EF4444', '#FFFFFF', 72, 44, 15),
      makeKeyBtn('btn_sign', '±', -40, 108, '#78350F', '#FEF3C7', 72, 44, 16),
      makeKeyBtn('btn_sq', 'x²', 40, 108, '#7C3AED', '#FFFFFF', 72, 44, 15),
      makeKeyBtn('btn_div', '÷', 120, 108, '#D97706', '#FFFFFF', 72, 44, 18),
      // Row 2: 7 8 9 ×
      makeKeyBtn('btn_7', '7', -120, 48),
      makeKeyBtn('btn_8', '8', -40, 48),
      makeKeyBtn('btn_9', '9', 40, 48),
      makeKeyBtn('btn_mul', '×', 120, 48, '#D97706', '#FFFFFF', 72, 46, 18),
      // Row 3: 4 5 6 −
      makeKeyBtn('btn_4', '4', -120, -12),
      makeKeyBtn('btn_5', '5', -40, -12),
      makeKeyBtn('btn_6', '6', 40, -12),
      makeKeyBtn('btn_sub', '−', 120, -12, '#D97706', '#FFFFFF', 72, 46, 18),
      // Row 4: 1 2 3 +
      makeKeyBtn('btn_1', '1', -120, -72),
      makeKeyBtn('btn_2', '2', -40, -72),
      makeKeyBtn('btn_3', '3', 40, -72),
      makeKeyBtn('btn_add', '+', 120, -72, '#D97706', '#FFFFFF', 72, 46, 18),
      // Row 5: 0 . =
      makeKeyBtn('btn_0', '0', -120, -132),
      makeKeyBtn('btn_dot', '.', -40, -132, '#FDE68A', '#451A03', 72, 46, 20),
      makeKeyBtn('btn_eq', '=', 80, -132, '#10B981', '#FFFFFF', 152, 46, 20),
      // Row 6: Voice Readout Bar
      makeKeyBtn('btn_speak', '🗣️ Speak Answer', -44, -194, '#EC4899', '#FFFFFF', 184, 38, 12),
      makeKeyBtn('btn_kitten', '🐱 Meow!', 108, -194, '#8B5CF6', '#FFFFFF', 96, 38, 12),
    ],
    variables: [
      {
        id: 'var-calc-solved',
        name: 'solved',
        value: 0,
        visible: true,
        readout: 'normal',
        sliderMin: 0,
        sliderMax: 999,
        x: -148,
        y: -252,
      },
      {
        id: 'var-calc-display',
        name: 'display',
        value: '0',
        visible: false,
        readout: 'normal',
        sliderMin: 0,
        sliderMax: 100,
        x: 0,
        y: 0,
      },
      {
        id: 'var-calc-first',
        name: 'first_num',
        value: 0,
        visible: false,
        readout: 'normal',
        sliderMin: 0,
        sliderMax: 100,
        x: 0,
        y: 0,
      },
      {
        id: 'var-calc-op',
        name: 'op',
        value: 'none',
        visible: false,
        readout: 'normal',
        sliderMin: 0,
        sliderMax: 100,
        x: 0,
        y: 0,
      },
      {
        id: 'var-calc-fresh',
        name: 'fresh_entry',
        value: 1,
        visible: false,
        readout: 'normal',
        sliderMin: 0,
        sliderMax: 1,
        x: 0,
        y: 0,
      },
    ],
    lists: [],
  };
}

export const PROJECT_TEMPLATES: ProjectTemplateMeta[] = [
  {
    id: 'tpl-ginger-quest',
    name: 'Gingerbread Star Quest',
    badge: 'Featured Mascot',
    description: 'Catch magic stars with arrow keys or trigger poses & spells via App UI buttons.',
    build: createDefaultProject,
  },
  {
    id: 'tpl-gingerbread-calculator',
    name: "Gingerbread Star's Gingerbread Calculator",
    badge: 'NEW · Cookie Calc 🍪',
    description:
      'Smartphone Gingerbread Calculator with +, −, ×, ÷, decimals, x², Marimba keypad & Alto/Kitten voice!',
    build: createGingerbreadCalculatorTemplate,
  },
  {
    id: 'tpl-chemist-mixer-lab',
    name: "Gingerbread Star's Chemist Mixer Lab",
    badge: 'NEW · Chemist Lab 🧪',
    description:
      'Mix Frost, Starberry & Solar reagents in the Reaction Flask, control Burner Heat, and brew elixirs!',
    build: createChemistMixerLabTemplate,
  },
  {
    id: 'tpl-extensions-arcade',
    name: 'Extensions Arcade & Physics Lab',
    badge: 'NEW · 8 Extensions',
    description:
      '2D Physics gravity + bounce, on-stage Arcade Pad, Music drums/marimba, Kitten TTS & Translate!',
    build: createExtensionsShowcaseTemplate,
  },
  {
    id: 'tpl-mobile-tapper',
    name: 'Star Bakery Mobile App',
    badge: '9:15 Phone App',
    description: 'Smartphone clicker app with progress bar, upgrades, toast alerts & variables.',
    build: createMobileClickerTemplate,
  },
  {
    id: 'tpl-spirograph',
    name: 'Neon Spirograph Art Maker',
    badge: 'Pen + Sliders',
    description: 'Generative rainbow mandala painter controlled by live App UI sliders.',
    build: createSpirographTemplate,
  },
  {
    id: 'tpl-quiz-voice',
    name: 'AI Voice & Math Quiz App',
    badge: 'Input + Speech',
    description: 'Mobile quiz app with text input validation and Web Speech voice feedback.',
    build: createQuizVoiceAppTemplate,
  },
  {
    id: 'tpl-blank',
    name: 'Blank Scratch Studio',
    badge: 'Clean Slate',
    description: 'Start fresh with Gingerbread Star (3 costumes) and an open Blockly workspace.',
    build: createBlankProject,
  },
];
