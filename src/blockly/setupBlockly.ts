import * as Blockly from 'blockly';
import { registerContinuousToolbox } from '@blockly/continuous-toolbox';
import { FieldColour, registerFieldColour } from '@blockly/field-colour';
import { FieldAngle, registerFieldAngle } from '@blockly/field-angle';
import type { ExtensionId } from '../types/studio';

export interface DynamicMenuContext {
  costumes: [string, string][];
  sounds: [string, string][];
  sprites: [string, string][];
  backdrops: [string, string][];
  widgets: [string, string][];
  variables: [string, string][];
  messages: [string, string][];
}

const dynamicCtx: DynamicMenuContext = {
  costumes: [['Peace Pose', 'Peace Pose']],
  sounds: [['Magic Chime', 'magic']],
  sprites: [['Star Gem', 'Star Gem']],
  backdrops: [['Gingerbread Snow Kingdom', 'Gingerbread Snow Kingdom']],
  widgets: [['btn_magic', 'btn_magic']],
  variables: [['score', 'score']],
  messages: [
    ['message1', 'message1'],
    ['start_game', 'start_game'],
    ['level_up', 'level_up'],
    ['game_over', 'game_over'],
  ],
};

export function updateBlocklyDynamicContext(partial: Partial<DynamicMenuContext>): void {
  if (partial.costumes && partial.costumes.length > 0) dynamicCtx.costumes = partial.costumes;
  if (partial.sounds && partial.sounds.length > 0) dynamicCtx.sounds = partial.sounds;
  if (partial.sprites) dynamicCtx.sprites = partial.sprites;
  if (partial.backdrops && partial.backdrops.length > 0) dynamicCtx.backdrops = partial.backdrops;
  if (partial.widgets && partial.widgets.length > 0) dynamicCtx.widgets = partial.widgets;
  if (partial.variables && partial.variables.length > 0) dynamicCtx.variables = partial.variables;
  if (partial.messages && partial.messages.length > 0) dynamicCtx.messages = partial.messages;
}

const BLOCK_STYLES: Record<string, Partial<Blockly.Theme.BlockStyle>> = {
  motion_blocks: {
    colourPrimary: '#4C97FF',
    colourSecondary: '#4280D7',
    colourTertiary: '#3373CC',
  },
  looks_blocks: {
    colourPrimary: '#9966FF',
    colourSecondary: '#855CD6',
    colourTertiary: '#774DCB',
  },
  sound_blocks: {
    colourPrimary: '#CF63CF',
    colourSecondary: '#C94FC9',
    colourTertiary: '#BD42BD',
  },
  events_hat_blocks: {
    colourPrimary: '#FFBF00',
    colourSecondary: '#E6AC00',
    colourTertiary: '#CC9900',
    hat: 'cap',
  },
  events_blocks: {
    colourPrimary: '#FFBF00',
    colourSecondary: '#E6AC00',
    colourTertiary: '#CC9900',
  },
  control_hat_blocks: {
    colourPrimary: '#FFAB19',
    colourSecondary: '#EC9C13',
    colourTertiary: '#CF8B17',
    hat: 'cap',
  },
  control_blocks: {
    colourPrimary: '#FFAB19',
    colourSecondary: '#EC9C13',
    colourTertiary: '#CF8B17',
  },
  sensing_blocks: {
    colourPrimary: '#5CB1D6',
    colourSecondary: '#47A8D1',
    colourTertiary: '#2E8EB8',
  },
  operator_blocks: {
    colourPrimary: '#59C059',
    colourSecondary: '#46B946',
    colourTertiary: '#389438',
  },
  data_blocks: {
    colourPrimary: '#FF8C1A',
    colourSecondary: '#FF8000',
    colourTertiary: '#DB6E00',
  },
  pen_blocks: {
    colourPrimary: '#0FBD8C',
    colourSecondary: '#0DA57A',
    colourTertiary: '#0B8E69',
  },
  music_blocks: {
    colourPrimary: '#0FBD8C',
    colourSecondary: '#0DA57A',
    colourTertiary: '#0B8E69',
  },
  tts_blocks: {
    colourPrimary: '#0FBD8C',
    colourSecondary: '#0DA57A',
    colourTertiary: '#0B8E69',
  },
  translate_blocks: {
    colourPrimary: '#0FBD8C',
    colourSecondary: '#0DA57A',
    colourTertiary: '#0B8E69',
  },
  video_hat_blocks: {
    colourPrimary: '#0FBD8C',
    colourSecondary: '#0DA57A',
    colourTertiary: '#0B8E69',
    hat: 'cap',
  },
  video_blocks: {
    colourPrimary: '#0FBD8C',
    colourSecondary: '#0DA57A',
    colourTertiary: '#0B8E69',
  },
  appui_hat_blocks: {
    colourPrimary: '#FF6680',
    colourSecondary: '#FF4D6A',
    colourTertiary: '#E63956',
    hat: 'cap',
  },
  appui_blocks: {
    colourPrimary: '#FF6680',
    colourSecondary: '#FF4D6A',
    colourTertiary: '#E63956',
  },
  storage_blocks: {
    colourPrimary: '#F59E0B',
    colourSecondary: '#D97706',
    colourTertiary: '#B45309',
  },
  physics_blocks: {
    colourPrimary: '#3B82F6',
    colourSecondary: '#2563EB',
    colourTertiary: '#1D4ED8',
  },
  gamepad_hat_blocks: {
    colourPrimary: '#EC4899',
    colourSecondary: '#DB2777',
    colourTertiary: '#BE185D',
    hat: 'cap',
  },
  gamepad_blocks: {
    colourPrimary: '#EC4899',
    colourSecondary: '#DB2777',
    colourTertiary: '#BE185D',
  },
  fx_blocks: {
    colourPrimary: '#7C3AED',
    colourSecondary: '#6D28D9',
    colourTertiary: '#5B21B6',
  },
};

const CATEGORY_STYLES: Record<string, Blockly.Theme.CategoryStyle> = {
  motion_category: { colour: '#4C97FF' },
  looks_category: { colour: '#9966FF' },
  sound_category: { colour: '#CF63CF' },
  events_category: { colour: '#FFBF00' },
  control_category: { colour: '#FFAB19' },
  sensing_category: { colour: '#5CB1D6' },
  operators_category: { colour: '#59C059' },
  data_category: { colour: '#FF8C1A' },
  music_category: { colour: '#0FBD8C' },
  pen_category: { colour: '#0FBD8C' },
  tts_category: { colour: '#0FBD8C' },
  translate_category: { colour: '#0FBD8C' },
  video_category: { colour: '#0FBD8C' },
  appui_category: { colour: '#FF6680' },
  storage_category: { colour: '#F59E0B' },
  physics_category: { colour: '#3B82F6' },
  gamepad_category: { colour: '#EC4899' },
  fx_category: { colour: '#7C3AED' },
};

export let scratchLightTheme: Blockly.Theme;
export let scratchDarkTheme: Blockly.Theme;

let initialized = false;

const KEY_OPTIONS: [string, string][] = [
  ['space', ' '],
  ['up arrow', 'ArrowUp'],
  ['down arrow', 'ArrowDown'],
  ['right arrow', 'ArrowRight'],
  ['left arrow', 'ArrowLeft'],
  ['any', 'any'],
  ['w', 'w'],
  ['a', 'a'],
  ['s', 's'],
  ['d', 'd'],
  ['enter', 'Enter'],
  ['1', '1'],
  ['2', '2'],
  ['3', '3'],
  ['e', 'e'],
  ['q', 'q'],
  ['z', 'z'],
  ['x', 'x'],
];

class ScratchDynamicDropdown extends Blockly.FieldDropdown {
  public pendingOptionValue: string | null = null;

  constructor(generator: () => [string, string][]) {
    super(function (this: Blockly.FieldDropdown) {
      const self = this as ScratchDynamicDropdown;
      const base = generator().map((item): [string, string] => [item[0], item[1]]);
      const current = self.pendingOptionValue ?? self.getValue();
      if (current && !base.some((opt) => opt[1] === current)) {
        base.push([current, current]);
      }
      return base.length > 0 ? base : [['default', 'default']];
    });
  }

  protected override doClassValidation_(newValue?: string): string | null {
    if (typeof newValue !== 'string' || newValue.length === 0) return null;
    this.pendingOptionValue = newValue;
    this.getOptions(false);
    return super.doClassValidation_(newValue) ?? null;
  }
}

function dynamicDropdown(generator: () => [string, string][]): Blockly.Field<string | undefined> {
  return new ScratchDynamicDropdown(generator) as unknown as Blockly.Field<string | undefined>;
}

export function initializeScratchBlockly(): void {
  if (initialized) return;
  initialized = true;

  registerContinuousToolbox();
  registerFieldColour();
  registerFieldAngle();

  scratchLightTheme = Blockly.Theme.defineTheme('scratch_zelos_light', {
    name: 'scratch_zelos_light',
    base: Blockly.Themes.Zelos,
    blockStyles: BLOCK_STYLES,
    categoryStyles: CATEGORY_STYLES,
    componentStyles: {
      workspaceBackgroundColour: '#F4F6FB',
      toolboxBackgroundColour: '#FFFFFF',
      toolboxForegroundColour: '#334155',
      flyoutBackgroundColour: '#F8FAFC',
      flyoutForegroundColour: '#1E293B',
      flyoutOpacity: 0.98,
      scrollbarColour: '#CBD5E1',
      scrollbarOpacity: 0.7,
    },
    fontStyle: {
      family: '"Inter Variable", Inter, system-ui, sans-serif',
      weight: '600',
      size: 12,
    },
  });

  scratchDarkTheme = Blockly.Theme.defineTheme('scratch_zelos_dark', {
    name: 'scratch_zelos_dark',
    base: Blockly.Themes.Zelos,
    blockStyles: BLOCK_STYLES,
    categoryStyles: CATEGORY_STYLES,
    componentStyles: {
      workspaceBackgroundColour: '#0F172A',
      toolboxBackgroundColour: '#111827',
      toolboxForegroundColour: '#E2E8F0',
      flyoutBackgroundColour: '#1E293B',
      flyoutForegroundColour: '#F8FAFC',
      flyoutOpacity: 0.98,
      scrollbarColour: '#475569',
      scrollbarOpacity: 0.7,
    },
    fontStyle: {
      family: '"Inter Variable", Inter, system-ui, sans-serif',
      weight: '600',
      size: 12,
    },
  });

  defineAllBlocks();
}

function defineAllBlocks(): void {
  const B = Blockly.Blocks;

  // ===================== EVENTS =====================
  B['event_whenflagclicked'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('🚩 when green flag clicked');
      this.setNextStatement(true, null);
      this.setStyle('events_hat_blocks');
    },
  };

  B['event_whenkeypressed'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('⌨️ when')
        .appendField(new Blockly.FieldDropdown(KEY_OPTIONS), 'KEY')
        .appendField('key pressed');
      this.setNextStatement(true, null);
      this.setStyle('events_hat_blocks');
    },
  };

  B['event_whenthisspriteclicked'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('👆 when this sprite clicked');
      this.setNextStatement(true, null);
      this.setStyle('events_hat_blocks');
    },
  };

  B['event_whenbroadcastreceived'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('📨 when I receive')
        .appendField(dynamicDropdown(() => dynamicCtx.messages), 'MESSAGE');
      this.setNextStatement(true, null);
      this.setStyle('events_hat_blocks');
    },
  };

  B['event_broadcast'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('📣 broadcast')
        .appendField(dynamicDropdown(() => dynamicCtx.messages), 'MESSAGE');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('events_blocks');
    },
  };

  B['event_broadcastandwait'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('📣 broadcast')
        .appendField(dynamicDropdown(() => dynamicCtx.messages), 'MESSAGE')
        .appendField('and wait');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('events_blocks');
    },
  };

  // ===================== MOTION =====================
  B['motion_movesteps'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('STEPS').setCheck('Number').appendField('move');
      this.appendDummyInput().appendField('steps');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('motion_blocks');
    },
  };

  B['motion_turnright'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('DEGREES').setCheck('Number').appendField('↻ turn right');
      this.appendDummyInput().appendField('degrees');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('motion_blocks');
    },
  };

  B['motion_turnleft'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('DEGREES').setCheck('Number').appendField('↺ turn left');
      this.appendDummyInput().appendField('degrees');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('motion_blocks');
    },
  };

  B['motion_gotoxy'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('X').setCheck('Number').appendField('go to x:');
      this.appendValueInput('Y').setCheck('Number').appendField('y:');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('motion_blocks');
    },
  };

  B['motion_goto'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('go to')
        .appendField(
          dynamicDropdown(() => [
            ['random position', '_random_'],
            ['mouse-pointer', '_mouse_'],
            ...dynamicCtx.sprites,
          ]),
          'TO'
        );
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('motion_blocks');
    },
  };

  B['motion_glidesecstoxy'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('SECS').setCheck('Number').appendField('glide');
      this.appendValueInput('X').setCheck('Number').appendField('secs to x:');
      this.appendValueInput('Y').setCheck('Number').appendField('y:');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('motion_blocks');
    },
  };

  B['motion_pointindirection'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('point in direction')
        .appendField(new FieldAngle(90), 'DIRECTION');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('motion_blocks');
    },
  };

  B['motion_pointtowards'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('point towards')
        .appendField(
          dynamicDropdown(() => [
            ['mouse-pointer', '_mouse_'],
            ...dynamicCtx.sprites,
          ]),
          'TOWARDS'
        );
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('motion_blocks');
    },
  };

  B['motion_changexby'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('DX').setCheck('Number').appendField('change x by');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('motion_blocks');
    },
  };

  B['motion_setx'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('X').setCheck('Number').appendField('set x to');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('motion_blocks');
    },
  };

  B['motion_changeyby'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('DY').setCheck('Number').appendField('change y by');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('motion_blocks');
    },
  };

  B['motion_sety'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('Y').setCheck('Number').appendField('set y to');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('motion_blocks');
    },
  };

  B['motion_ifonedgebounce'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('if on edge, bounce');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('motion_blocks');
    },
  };

  B['motion_setrotationstyle'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('set rotation style')
        .appendField(
          new Blockly.FieldDropdown([
            ['left-right', 'left-right'],
            ["don't rotate", "don't rotate"],
            ['all around', 'all around'],
          ]),
          'STYLE'
        );
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('motion_blocks');
    },
  };

  B['motion_xposition'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('x position');
      this.setOutput(true, 'Number');
      this.setStyle('motion_blocks');
    },
  };

  B['motion_yposition'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('y position');
      this.setOutput(true, 'Number');
      this.setStyle('motion_blocks');
    },
  };

  B['motion_direction'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('direction');
      this.setOutput(true, 'Number');
      this.setStyle('motion_blocks');
    },
  };

  // ===================== LOOKS =====================
  B['looks_sayforsecs'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('MESSAGE').appendField('say');
      this.appendValueInput('SECS').setCheck('Number').appendField('for');
      this.appendDummyInput().appendField('seconds');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('looks_blocks');
    },
  };

  B['looks_say'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('MESSAGE').appendField('say');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('looks_blocks');
    },
  };

  B['looks_thinkforsecs'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('MESSAGE').appendField('think');
      this.appendValueInput('SECS').setCheck('Number').appendField('for');
      this.appendDummyInput().appendField('seconds');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('looks_blocks');
    },
  };

  B['looks_switchcostumeto'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('switch costume to')
        .appendField(dynamicDropdown(() => dynamicCtx.costumes), 'COSTUME');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('looks_blocks');
    },
  };

  B['looks_nextcostume'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('next costume');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('looks_blocks');
    },
  };

  B['looks_switchbackdropto'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('switch backdrop to')
        .appendField(dynamicDropdown(() => dynamicCtx.backdrops), 'BACKDROP');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('looks_blocks');
    },
  };

  B['looks_nextbackdrop'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('next backdrop');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('looks_blocks');
    },
  };

  B['looks_changesizeby'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('CHANGE').setCheck('Number').appendField('change size by');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('looks_blocks');
    },
  };

  B['looks_setsizeto'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('SIZE').setCheck('Number').appendField('set size to');
      this.appendDummyInput().appendField('%');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('looks_blocks');
    },
  };

  B['looks_changeeffectby'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('change')
        .appendField(
          new Blockly.FieldDropdown([
            ['color', 'color'],
            ['brightness', 'brightness'],
            ['ghost', 'ghost'],
          ]),
          'EFFECT'
        )
        .appendField('effect by');
      this.appendValueInput('CHANGE').setCheck('Number');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('looks_blocks');
    },
  };

  B['looks_seteffectto'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('set')
        .appendField(
          new Blockly.FieldDropdown([
            ['color', 'color'],
            ['brightness', 'brightness'],
            ['ghost', 'ghost'],
          ]),
          'EFFECT'
        )
        .appendField('effect to');
      this.appendValueInput('VALUE').setCheck('Number');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('looks_blocks');
    },
  };

  B['looks_cleargraphiceffects'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('clear graphic effects');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('looks_blocks');
    },
  };

  B['looks_show'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('show');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('looks_blocks');
    },
  };

  B['looks_hide'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('hide');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('looks_blocks');
    },
  };

  B['looks_size'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('size');
      this.setOutput(true, 'Number');
      this.setStyle('looks_blocks');
    },
  };

  B['looks_costumename'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('costume name');
      this.setOutput(true, 'String');
      this.setStyle('looks_blocks');
    },
  };

  // ===================== SOUND & VOICE =====================
  B['sound_play'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('🔊 start sound')
        .appendField(dynamicDropdown(() => dynamicCtx.sounds), 'SOUND');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('sound_blocks');
    },
  };

  B['sound_playuntildone'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('🔊 play sound')
        .appendField(dynamicDropdown(() => dynamicCtx.sounds), 'SOUND')
        .appendField('until done');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('sound_blocks');
    },
  };

  B['sound_playnote'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('🎹 play note')
        .appendField(
          new Blockly.FieldDropdown([
            ['C4 (60)', '60'],
            ['D4 (62)', '62'],
            ['E4 (64)', '64'],
            ['F4 (65)', '65'],
            ['G4 (67)', '67'],
            ['A4 (69)', '69'],
            ['B4 (71)', '71'],
            ['C5 (72)', '72'],
            ['E5 (76)', '76'],
            ['G5 (79)', '79'],
            ['C6 (84)', '84'],
          ]),
          'NOTE'
        );
      this.appendValueInput('BEATS').setCheck('Number').appendField('for');
      this.appendDummyInput().appendField('beats');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('sound_blocks');
    },
  };

  B['sound_speak'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('TEXT').appendField('🗣️ speak');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('sound_blocks');
    },
  };

  B['sound_setvolumeto'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('VOLUME').setCheck('Number').appendField('set volume to');
      this.appendDummyInput().appendField('%');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('sound_blocks');
    },
  };

  B['sound_stopallsounds'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('stop all sounds');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('sound_blocks');
    },
  };

  // ===================== CONTROL & CLONES =====================
  B['control_wait'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('DURATION').setCheck('Number').appendField('wait');
      this.appendDummyInput().appendField('seconds');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('control_blocks');
    },
  };

  B['control_repeat'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('TIMES').setCheck('Number').appendField('repeat');
      this.appendStatementInput('SUBSTACK');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('control_blocks');
    },
  };

  B['control_forever'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('forever');
      this.appendStatementInput('SUBSTACK');
      this.setPreviousStatement(true, null);
      this.setStyle('control_blocks');
    },
  };

  B['control_if'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('CONDITION').setCheck('Boolean').appendField('if');
      this.appendDummyInput().appendField('then');
      this.appendStatementInput('SUBSTACK');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('control_blocks');
    },
  };

  B['control_if_else'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('CONDITION').setCheck('Boolean').appendField('if');
      this.appendDummyInput().appendField('then');
      this.appendStatementInput('SUBSTACK');
      this.appendDummyInput().appendField('else');
      this.appendStatementInput('SUBSTACK2');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('control_blocks');
    },
  };

  B['control_wait_until'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('CONDITION').setCheck('Boolean').appendField('wait until');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('control_blocks');
    },
  };

  B['control_repeat_until'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('CONDITION').setCheck('Boolean').appendField('repeat until');
      this.appendStatementInput('SUBSTACK');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('control_blocks');
    },
  };

  B['control_stop'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('stop')
        .appendField(
          new Blockly.FieldDropdown([
            ['all', 'all'],
            ['this script', 'this script'],
          ]),
          'STOP_OPTION'
        );
      this.setPreviousStatement(true, null);
      this.setStyle('control_blocks');
    },
  };

  B['control_start_as_clone'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('🧬 when I start as a clone');
      this.setNextStatement(true, null);
      this.setStyle('control_hat_blocks');
    },
  };

  B['control_create_clone_of'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('create clone of')
        .appendField(
          dynamicDropdown(() => [['myself', '_myself_'], ...dynamicCtx.sprites]),
          'CLONE_OPTION'
        );
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('control_blocks');
    },
  };

  B['control_delete_this_clone'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('delete this clone');
      this.setPreviousStatement(true, null);
      this.setStyle('control_blocks');
    },
  };

  // ===================== SENSING =====================
  B['sensing_touchingobject'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('touching')
        .appendField(
          dynamicDropdown(() => [
            ['mouse-pointer', '_mouse_'],
            ['edge', '_edge_'],
            ...dynamicCtx.sprites,
          ]),
          'TOUCHINGOBJECTMENU'
        )
        .appendField('?');
      this.setOutput(true, 'Boolean');
      this.setStyle('sensing_blocks');
    },
  };

  B['sensing_keypressed'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('key')
        .appendField(new Blockly.FieldDropdown(KEY_OPTIONS), 'KEY_OPTION')
        .appendField('pressed?');
      this.setOutput(true, 'Boolean');
      this.setStyle('sensing_blocks');
    },
  };

  B['sensing_mousedown'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('mouse down?');
      this.setOutput(true, 'Boolean');
      this.setStyle('sensing_blocks');
    },
  };

  B['sensing_mousex'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('mouse x');
      this.setOutput(true, 'Number');
      this.setStyle('sensing_blocks');
    },
  };

  B['sensing_mousey'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('mouse y');
      this.setOutput(true, 'Number');
      this.setStyle('sensing_blocks');
    },
  };

  B['sensing_distanceto'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('distance to')
        .appendField(
          dynamicDropdown(() => [
            ['mouse-pointer', '_mouse_'],
            ...dynamicCtx.sprites,
          ]),
          'DISTANCETOMENU'
        );
      this.setOutput(true, 'Number');
      this.setStyle('sensing_blocks');
    },
  };

  B['sensing_askandwait'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('QUESTION').appendField('ask');
      this.appendDummyInput().appendField('and wait');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('sensing_blocks');
    },
  };

  B['sensing_answer'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('answer');
      this.setOutput(true, 'String');
      this.setStyle('sensing_blocks');
    },
  };

  B['sensing_timer'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('timer');
      this.setOutput(true, 'Number');
      this.setStyle('sensing_blocks');
    },
  };

  B['sensing_resettimer'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('reset timer');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('sensing_blocks');
    },
  };

  // ===================== OPERATORS & LITERALS =====================
  B['math_number_scratch'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField(new Blockly.FieldNumber(10), 'NUM');
      this.setOutput(true, 'Number');
      this.setStyle('operator_blocks');
    },
  };

  B['text_scratch'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField(new Blockly.FieldTextInput('Hello!'), 'TEXT');
      this.setOutput(true, 'String');
      this.setStyle('operator_blocks');
    },
  };

  B['operator_add'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('NUM1').setCheck('Number');
      this.appendValueInput('NUM2').setCheck('Number').appendField('+');
      this.setInputsInline(true);
      this.setOutput(true, 'Number');
      this.setStyle('operator_blocks');
    },
  };

  B['operator_subtract'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('NUM1').setCheck('Number');
      this.appendValueInput('NUM2').setCheck('Number').appendField('−');
      this.setInputsInline(true);
      this.setOutput(true, 'Number');
      this.setStyle('operator_blocks');
    },
  };

  B['operator_multiply'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('NUM1').setCheck('Number');
      this.appendValueInput('NUM2').setCheck('Number').appendField('×');
      this.setInputsInline(true);
      this.setOutput(true, 'Number');
      this.setStyle('operator_blocks');
    },
  };

  B['operator_divide'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('NUM1').setCheck('Number');
      this.appendValueInput('NUM2').setCheck('Number').appendField('÷');
      this.setInputsInline(true);
      this.setOutput(true, 'Number');
      this.setStyle('operator_blocks');
    },
  };

  B['operator_random'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('FROM').setCheck('Number').appendField('pick random');
      this.appendValueInput('TO').setCheck('Number').appendField('to');
      this.setInputsInline(true);
      this.setOutput(true, 'Number');
      this.setStyle('operator_blocks');
    },
  };

  B['operator_gt'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('OPERAND1');
      this.appendValueInput('OPERAND2').appendField('>');
      this.setInputsInline(true);
      this.setOutput(true, 'Boolean');
      this.setStyle('operator_blocks');
    },
  };

  B['operator_lt'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('OPERAND1');
      this.appendValueInput('OPERAND2').appendField('<');
      this.setInputsInline(true);
      this.setOutput(true, 'Boolean');
      this.setStyle('operator_blocks');
    },
  };

  B['operator_equals'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('OPERAND1');
      this.appendValueInput('OPERAND2').appendField('=');
      this.setInputsInline(true);
      this.setOutput(true, 'Boolean');
      this.setStyle('operator_blocks');
    },
  };

  B['operator_and'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('OPERAND1').setCheck('Boolean');
      this.appendValueInput('OPERAND2').setCheck('Boolean').appendField('and');
      this.setInputsInline(true);
      this.setOutput(true, 'Boolean');
      this.setStyle('operator_blocks');
    },
  };

  B['operator_or'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('OPERAND1').setCheck('Boolean');
      this.appendValueInput('OPERAND2').setCheck('Boolean').appendField('or');
      this.setInputsInline(true);
      this.setOutput(true, 'Boolean');
      this.setStyle('operator_blocks');
    },
  };

  B['operator_not'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('OPERAND').setCheck('Boolean').appendField('not');
      this.setInputsInline(true);
      this.setOutput(true, 'Boolean');
      this.setStyle('operator_blocks');
    },
  };

  B['operator_join'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('STRING1').appendField('join');
      this.appendValueInput('STRING2');
      this.setInputsInline(true);
      this.setOutput(true, 'String');
      this.setStyle('operator_blocks');
    },
  };

  B['operator_mod'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('NUM1').setCheck('Number');
      this.appendValueInput('NUM2').setCheck('Number').appendField('mod');
      this.setInputsInline(true);
      this.setOutput(true, 'Number');
      this.setStyle('operator_blocks');
    },
  };

  B['operator_round'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('NUM').setCheck('Number').appendField('round');
      this.setInputsInline(true);
      this.setOutput(true, 'Number');
      this.setStyle('operator_blocks');
    },
  };

  B['operator_mathop'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField(
          new Blockly.FieldDropdown([
            ['abs', 'abs'],
            ['floor', 'floor'],
            ['ceiling', 'ceiling'],
            ['sqrt', 'sqrt'],
            ['sin', 'sin'],
            ['cos', 'cos'],
          ]),
          'OPERATOR'
        )
        .appendField('of');
      this.appendValueInput('NUM').setCheck('Number');
      this.setInputsInline(true);
      this.setOutput(true, 'Number');
      this.setStyle('operator_blocks');
    },
  };

  // ===================== VARIABLES =====================
  B['data_variable'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('📦')
        .appendField(dynamicDropdown(() => dynamicCtx.variables), 'VARIABLE');
      this.setOutput(true, null);
      this.setStyle('data_blocks');
    },
  };

  B['data_setvariableto'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('set')
        .appendField(dynamicDropdown(() => dynamicCtx.variables), 'VARIABLE')
        .appendField('to');
      this.appendValueInput('VALUE');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('data_blocks');
    },
  };

  B['data_changevariableby'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('change')
        .appendField(dynamicDropdown(() => dynamicCtx.variables), 'VARIABLE')
        .appendField('by');
      this.appendValueInput('VALUE').setCheck('Number');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('data_blocks');
    },
  };

  B['data_showvariable'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('show variable')
        .appendField(dynamicDropdown(() => dynamicCtx.variables), 'VARIABLE');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('data_blocks');
    },
  };

  B['data_hidevariable'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('hide variable')
        .appendField(dynamicDropdown(() => dynamicCtx.variables), 'VARIABLE');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('data_blocks');
    },
  };

  // ===================== PEN EXTENSION =====================
  B['pen_clear'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('✏️ erase all');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('pen_blocks');
    },
  };

  B['pen_stamp'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('✏️ stamp');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('pen_blocks');
    },
  };

  B['pen_pendown'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('✏️ pen down');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('pen_blocks');
    },
  };

  B['pen_penup'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('✏️ pen up');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('pen_blocks');
    },
  };

  B['pen_setpencolorto'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('✏️ set pen color to')
        .appendField(new FieldColour('#7C3AED'), 'COLOR');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('pen_blocks');
    },
  };

  B['pen_changepenhueby'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('HUE').setCheck('Number').appendField('✏️ change pen hue by');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('pen_blocks');
    },
  };

  B['pen_setpensizeto'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('SIZE').setCheck('Number').appendField('✏️ set pen size to');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('pen_blocks');
    },
  };

  B['pen_changepensizeby'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('SIZE').setCheck('Number').appendField('✏️ change pen size by');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('pen_blocks');
    },
  };

  B['pen_setpentransparencyto'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('TRANSPARENCY')
        .setCheck('Number')
        .appendField('✏️ set pen transparency to');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('pen_blocks');
    },
  };

  // ===================== MUSIC EXTENSION =====================
  const MUSIC_NOTE_OPTIONS: [string, string][] = [
    ['Low C (48)', '48'],
    ['Low D (50)', '50'],
    ['Low E (52)', '52'],
    ['Low F (53)', '53'],
    ['Low G (55)', '55'],
    ['Low A (57)', '57'],
    ['Low B (59)', '59'],
    ['Middle C (60)', '60'],
    ['C# (61)', '61'],
    ['D (62)', '62'],
    ['D# (63)', '63'],
    ['E (64)', '64'],
    ['F (65)', '65'],
    ['F# (66)', '66'],
    ['G (67)', '67'],
    ['G# (68)', '68'],
    ['A (69)', '69'],
    ['A# (70)', '70'],
    ['B (71)', '71'],
    ['High C (72)', '72'],
    ['High D (74)', '74'],
    ['High E (76)', '76'],
    ['High G (79)', '79'],
  ];

  B['music_playdrum'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('🥁 play drum')
        .appendField(
          new Blockly.FieldDropdown([
            ['(1) Snare Drum', 'snare'],
            ['(2) Bass Drum', 'bass'],
            ['(3) Side Stick', 'sidestick'],
            ['(4) Crash Cymbal', 'crash'],
            ['(5) Open Hi-Hat', 'openhihat'],
            ['(6) Closed Hi-Hat', 'closedhihat'],
            ['(7) Tambourine', 'tambourine'],
            ['(8) Hand Clap', 'clap'],
          ]),
          'DRUM'
        )
        .appendField('for');
      this.appendValueInput('BEATS').setCheck('Number');
      this.appendDummyInput().appendField('beats');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('music_blocks');
    },
  };

  B['music_rest'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('BEATS').setCheck('Number').appendField('🎵 rest for');
      this.appendDummyInput().appendField('beats');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('music_blocks');
    },
  };

  B['music_playnote'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('🎵 play note')
        .appendField(new Blockly.FieldDropdown(MUSIC_NOTE_OPTIONS), 'NOTE')
        .appendField('for');
      this.appendValueInput('BEATS').setCheck('Number');
      this.appendDummyInput().appendField('beats');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('music_blocks');
    },
  };

  B['music_setinstrument'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('🎹 set instrument to')
        .appendField(
          new Blockly.FieldDropdown([
            ['(1) Acoustic Piano', 'piano'],
            ['(2) Electric Piano', 'epiano'],
            ['(3) Organ', 'organ'],
            ['(4) Guitar', 'guitar'],
            ['(5) Synth Lead', 'synth'],
            ['(6) Flute', 'flute'],
            ['(7) Marimba', 'marimba'],
            ['(8) Retro Chiptune', 'chiptune'],
          ]),
          'INSTRUMENT'
        );
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('music_blocks');
    },
  };

  B['music_settempo'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('TEMPO').setCheck('Number').appendField('🎵 set tempo to');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('music_blocks');
    },
  };

  B['music_changetempo'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('TEMPO').setCheck('Number').appendField('🎵 change tempo by');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('music_blocks');
    },
  };

  B['music_gettempo'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('🎵 tempo');
      this.setOutput(true, 'Number');
      this.setStyle('music_blocks');
    },
  };

  // ===================== TEXT TO SPEECH EXTENSION =====================
  B['tts_speak'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('TEXT').appendField('🗣️ speak');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('tts_blocks');
    },
  };

  B['tts_setvoice'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('🗣️ set voice to')
        .appendField(
          new Blockly.FieldDropdown([
            ['alto', 'alto'],
            ['tenor', 'tenor'],
            ['squeak', 'squeak'],
            ['giant', 'giant'],
            ['kitten 🐱', 'kitten'],
          ]),
          'VOICE'
        );
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('tts_blocks');
    },
  };

  B['tts_setlanguage'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('🗣️ set voice language to')
        .appendField(
          new Blockly.FieldDropdown([
            ['English', 'en-US'],
            ['Spanish (Español)', 'es-ES'],
            ['French (Français)', 'fr-FR'],
            ['Japanese (日本語)', 'ja-JP'],
            ['Korean (한국어)', 'ko-KR'],
            ['German (Deutsch)', 'de-DE'],
            ['Italian (Italiano)', 'it-IT'],
            ['Portuguese (Português)', 'pt-BR'],
          ]),
          'LANG'
        );
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('tts_blocks');
    },
  };

  // ===================== TRANSLATE EXTENSION =====================
  B['translate_gettext'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('WORDS').appendField('🌐 translate');
      this.appendDummyInput()
        .appendField('to')
        .appendField(
          new Blockly.FieldDropdown([
            ['Spanish (Español)', 'es'],
            ['French (Français)', 'fr'],
            ['Japanese (日本語)', 'ja'],
            ['Korean (한국어)', 'ko'],
            ['German (Deutsch)', 'de'],
            ['Italian (Italiano)', 'it'],
            ['Portuguese (Português)', 'pt'],
            ['Emoji Speak ✨', 'emoji'],
          ]),
          'LANG'
        );
      this.setInputsInline(true);
      this.setOutput(true, 'String');
      this.setStyle('translate_blocks');
    },
  };

  B['translate_getviewerlanguage'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('🌐 language');
      this.setOutput(true, 'String');
      this.setStyle('translate_blocks');
    },
  };

  // ===================== VIDEO SENSING EXTENSION =====================
  B['video_whenmotiongreaterthan'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('THRESHOLD')
        .setCheck('Number')
        .appendField('📹 when video motion >');
      this.setInputsInline(true);
      this.setNextStatement(true, null);
      this.setStyle('video_hat_blocks');
    },
  };

  B['video_motion'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('📹 video')
        .appendField(
          new Blockly.FieldDropdown([
            ['motion', 'motion'],
            ['direction', 'direction'],
          ]),
          'ATTRIBUTE'
        )
        .appendField('on')
        .appendField(
          new Blockly.FieldDropdown([
            ['stage', 'stage'],
            ['this sprite', 'sprite'],
          ]),
          'SUBJECT'
        );
      this.setOutput(true, 'Number');
      this.setStyle('video_blocks');
    },
  };

  B['video_turn'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('📹 turn video')
        .appendField(
          new Blockly.FieldDropdown([
            ['on', 'on'],
            ['off', 'off'],
            ['on flipped', 'on-flipped'],
          ]),
          'STATE'
        );
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('video_blocks');
    },
  };

  B['video_settransparency'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('TRANSPARENCY')
        .setCheck('Number')
        .appendField('📹 set video transparency to');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('video_blocks');
    },
  };

  // ===================== CLOUD & LOCAL SAVE EXTENSION =====================
  B['storage_save'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('VALUE').appendField('💾 save');
      this.appendValueInput('KEY').appendField('to key');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('storage_blocks');
    },
  };

  B['storage_load'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('KEY').appendField('💾 load key');
      this.setInputsInline(true);
      this.setOutput(true, null);
      this.setStyle('storage_blocks');
    },
  };

  B['storage_has_key'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('KEY').appendField('💾 saved key');
      this.appendDummyInput().appendField('exists?');
      this.setInputsInline(true);
      this.setOutput(true, 'Boolean');
      this.setStyle('storage_blocks');
    },
  };

  B['storage_delete_key'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('KEY').appendField('💾 delete saved key');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('storage_blocks');
    },
  };

  B['storage_clear'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('💾 clear all saved data');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('storage_blocks');
    },
  };

  // ===================== 2D PHYSICS ENGINE EXTENSION =====================
  B['physics_enable'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('🪐 set physics mode')
        .appendField(
          new Blockly.FieldDropdown([
            ['dynamic body (gravity)', 'dynamic'],
            ['solid platform', 'platform'],
            ['off', 'off'],
          ]),
          'MODE'
        );
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('physics_blocks');
    },
  };

  B['physics_set_gravity'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('GRAVITY').setCheck('Number').appendField('🪐 set stage gravity to');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('physics_blocks');
    },
  };

  B['physics_set_velocity'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('VX').setCheck('Number').appendField('🪐 set velocity vx:');
      this.appendValueInput('VY').setCheck('Number').appendField('vy:');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('physics_blocks');
    },
  };

  B['physics_jump'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('POWER').setCheck('Number').appendField('🪐 jump with power');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('physics_blocks');
    },
  };

  B['physics_push'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('FX').setCheck('Number').appendField('🪐 push impulse fx:');
      this.appendValueInput('FY').setCheck('Number').appendField('fy:');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('physics_blocks');
    },
  };

  B['physics_set_bounciness'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('BOUNCE').setCheck('Number').appendField('🪐 set bounce');
      this.appendValueInput('FRICTION').setCheck('Number').appendField('% friction');
      this.appendDummyInput().appendField('%');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('physics_blocks');
    },
  };

  B['physics_on_ground'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('🪐 on ground?');
      this.setOutput(true, 'Boolean');
      this.setStyle('physics_blocks');
    },
  };

  B['physics_velocity'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('🪐')
        .appendField(
          new Blockly.FieldDropdown([
            ['x velocity (vx)', 'vx'],
            ['y velocity (vy)', 'vy'],
          ]),
          'AXIS'
        );
      this.setOutput(true, 'Number');
      this.setStyle('physics_blocks');
    },
  };

  // ===================== GAMEPAD & ARCADE PAD EXTENSION =====================
  const PAD_BUTTON_OPTIONS: [string, string][] = [
    ['A button', 'A'],
    ['B button', 'B'],
    ['D-pad Up', 'up'],
    ['D-pad Down', 'down'],
    ['D-pad Left', 'left'],
    ['D-pad Right', 'right'],
  ];

  B['gamepad_show_virtual'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('🎮')
        .appendField(
          new Blockly.FieldDropdown([
            ['show', 'show'],
            ['hide', 'hide'],
          ]),
          'STATE'
        )
        .appendField('on-stage arcade pad');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('gamepad_blocks');
    },
  };

  B['gamepad_when_button'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('🎮 when arcade')
        .appendField(new Blockly.FieldDropdown(PAD_BUTTON_OPTIONS), 'BUTTON')
        .appendField('pressed');
      this.setNextStatement(true, null);
      this.setStyle('gamepad_hat_blocks');
    },
  };

  B['gamepad_button_down'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('🎮 arcade')
        .appendField(new Blockly.FieldDropdown(PAD_BUTTON_OPTIONS), 'BUTTON')
        .appendField('pressed?');
      this.setOutput(true, 'Boolean');
      this.setStyle('gamepad_blocks');
    },
  };

  B['gamepad_axis'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('🎮 joystick')
        .appendField(
          new Blockly.FieldDropdown([
            ['horizontal (-1 to 1)', 'horizontal'],
            ['vertical (-1 to 1)', 'vertical'],
          ]),
          'AXIS'
        );
      this.setOutput(true, 'Number');
      this.setStyle('gamepad_blocks');
    },
  };

  // ===================== APP UI MAKER EXTENSION =====================
  B['appui_when_clicked'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('📱 when UI button')
        .appendField(dynamicDropdown(() => dynamicCtx.widgets), 'WIDGET')
        .appendField('clicked');
      this.setNextStatement(true, null);
      this.setStyle('appui_hat_blocks');
    },
  };

  B['appui_set_text'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('📱 set UI')
        .appendField(dynamicDropdown(() => dynamicCtx.widgets), 'WIDGET')
        .appendField('label to');
      this.appendValueInput('TEXT');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('appui_blocks');
    },
  };

  B['appui_set_value'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('📱 set UI')
        .appendField(dynamicDropdown(() => dynamicCtx.widgets), 'WIDGET')
        .appendField('value to');
      this.appendValueInput('VALUE');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('appui_blocks');
    },
  };

  B['appui_get_value'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('📱 UI')
        .appendField(dynamicDropdown(() => dynamicCtx.widgets), 'WIDGET')
        .appendField('value');
      this.setOutput(true, null);
      this.setStyle('appui_blocks');
    },
  };

  B['appui_set_visible'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('📱')
        .appendField(
          new Blockly.FieldDropdown([
            ['show', 'show'],
            ['hide', 'hide'],
          ]),
          'VISIBILITY'
        )
        .appendField('UI widget')
        .appendField(dynamicDropdown(() => dynamicCtx.widgets), 'WIDGET');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('appui_blocks');
    },
  };

  B['appui_create_button'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('📱 create button id:')
        .appendField(new Blockly.FieldTextInput('my_btn'), 'ID');
      this.appendValueInput('LABEL').appendField('text:');
      this.appendValueInput('X').setCheck('Number').appendField('x:');
      this.appendValueInput('Y').setCheck('Number').appendField('y:');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('appui_blocks');
    },
  };

  B['appui_toast'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('MESSAGE').appendField('📱 show app notification');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('appui_blocks');
    },
  };

  // ===================== JUICE / PARTICLES / FX EXTENSION =====================
  B['fx_particles'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('✨ burst')
        .appendField(
          new Blockly.FieldDropdown([
            ['⭐ magic stars', 'stars'],
            ['🎊 confetti', 'confetti'],
            ['💖 hearts', 'hearts'],
            ['❄️ snowflakes', 'snow'],
            ['🔮 arcane sparks', 'magic'],
            ['🔥 flame sparks', 'fire'],
          ]),
          'KIND'
        );
      this.appendValueInput('COUNT').setCheck('Number').appendField('count:');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('fx_blocks');
    },
  };

  B['fx_screenshake'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('INTENSITY').setCheck('Number').appendField('💥 screen shake power');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('fx_blocks');
    },
  };

  B['fx_flash'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput()
        .appendField('⚡ screen flash')
        .appendField(new FieldColour('#FFFFFF'), 'COLOR');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('fx_blocks');
    },
  };

  B['fx_camera_zoom'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('ZOOM')
        .setCheck('Number')
        .appendField('🎥 set stage camera zoom to');
      this.appendDummyInput().appendField('%');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('fx_blocks');
    },
  };

  B['fx_camera_pan'] = {
    init(this: Blockly.Block) {
      this.appendValueInput('X').setCheck('Number').appendField('🎥 pan stage camera x:');
      this.appendValueInput('Y').setCheck('Number').appendField('y:');
      this.setInputsInline(true);
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('fx_blocks');
    },
  };

  B['fx_camera_reset'] = {
    init(this: Blockly.Block) {
      this.appendDummyInput().appendField('🎥 reset stage camera');
      this.setPreviousStatement(true, null);
      this.setNextStatement(true, null);
      this.setStyle('fx_blocks');
    },
  };
}

function numShadow(n: number) {
  return { shadow: { type: 'math_number_scratch', fields: { NUM: n } } };
}

function textShadow(t: string) {
  return { shadow: { type: 'text_scratch', fields: { TEXT: t } } };
}

const CORE_TOOLBOX_CATEGORIES: Blockly.utils.toolbox.ToolboxItemInfo[] = [
    {
      kind: 'category',
      name: 'Motion',
      categorystyle: 'motion_category',
      contents: [
        { kind: 'block', type: 'motion_movesteps', inputs: { STEPS: numShadow(10) } },
        { kind: 'block', type: 'motion_turnright', inputs: { DEGREES: numShadow(15) } },
        { kind: 'block', type: 'motion_turnleft', inputs: { DEGREES: numShadow(15) } },
        { kind: 'block', type: 'motion_goto' },
        { kind: 'block', type: 'motion_gotoxy', inputs: { X: numShadow(0), Y: numShadow(0) } },
        {
          kind: 'block',
          type: 'motion_glidesecstoxy',
          inputs: { SECS: numShadow(1), X: numShadow(0), Y: numShadow(0) },
        },
        { kind: 'block', type: 'motion_pointindirection' },
        { kind: 'block', type: 'motion_pointtowards' },
        { kind: 'block', type: 'motion_changexby', inputs: { DX: numShadow(10) } },
        { kind: 'block', type: 'motion_setx', inputs: { X: numShadow(0) } },
        { kind: 'block', type: 'motion_changeyby', inputs: { DY: numShadow(10) } },
        { kind: 'block', type: 'motion_sety', inputs: { Y: numShadow(0) } },
        { kind: 'block', type: 'motion_ifonedgebounce' },
        { kind: 'block', type: 'motion_setrotationstyle' },
        { kind: 'block', type: 'motion_xposition' },
        { kind: 'block', type: 'motion_yposition' },
        { kind: 'block', type: 'motion_direction' },
      ],
    },
    {
      kind: 'category',
      name: 'Looks',
      categorystyle: 'looks_category',
      contents: [
        {
          kind: 'block',
          type: 'looks_sayforsecs',
          inputs: { MESSAGE: textShadow('Hello! ✨'), SECS: numShadow(2) },
        },
        { kind: 'block', type: 'looks_say', inputs: { MESSAGE: textShadow('Hello!') } },
        {
          kind: 'block',
          type: 'looks_thinkforsecs',
          inputs: { MESSAGE: textShadow('Hmm...'), SECS: numShadow(2) },
        },
        { kind: 'block', type: 'looks_switchcostumeto' },
        { kind: 'block', type: 'looks_nextcostume' },
        { kind: 'block', type: 'looks_switchbackdropto' },
        { kind: 'block', type: 'looks_nextbackdrop' },
        { kind: 'block', type: 'looks_changesizeby', inputs: { CHANGE: numShadow(10) } },
        { kind: 'block', type: 'looks_setsizeto', inputs: { SIZE: numShadow(100) } },
        { kind: 'block', type: 'looks_changeeffectby', inputs: { CHANGE: numShadow(25) } },
        { kind: 'block', type: 'looks_seteffectto', inputs: { VALUE: numShadow(0) } },
        { kind: 'block', type: 'looks_cleargraphiceffects' },
        { kind: 'block', type: 'looks_show' },
        { kind: 'block', type: 'looks_hide' },
        { kind: 'block', type: 'looks_size' },
        { kind: 'block', type: 'looks_costumename' },
      ],
    },
    {
      kind: 'category',
      name: 'Sound',
      categorystyle: 'sound_category',
      contents: [
        { kind: 'block', type: 'sound_play' },
        { kind: 'block', type: 'sound_playuntildone' },
        { kind: 'block', type: 'sound_playnote', inputs: { BEATS: numShadow(0.5) } },
        { kind: 'block', type: 'sound_speak', inputs: { TEXT: textShadow('Let us build an app!') } },
        { kind: 'block', type: 'sound_setvolumeto', inputs: { VOLUME: numShadow(80) } },
        { kind: 'block', type: 'sound_stopallsounds' },
      ],
    },
    {
      kind: 'category',
      name: 'Events',
      categorystyle: 'events_category',
      contents: [
        { kind: 'block', type: 'event_whenflagclicked' },
        { kind: 'block', type: 'event_whenkeypressed' },
        { kind: 'block', type: 'event_whenthisspriteclicked' },
        { kind: 'block', type: 'event_whenbroadcastreceived' },
        { kind: 'block', type: 'event_broadcast' },
        { kind: 'block', type: 'event_broadcastandwait' },
      ],
    },
    {
      kind: 'category',
      name: 'Control',
      categorystyle: 'control_category',
      contents: [
        { kind: 'block', type: 'control_wait', inputs: { DURATION: numShadow(1) } },
        { kind: 'block', type: 'control_repeat', inputs: { TIMES: numShadow(10) } },
        { kind: 'block', type: 'control_forever' },
        { kind: 'block', type: 'control_if' },
        { kind: 'block', type: 'control_if_else' },
        { kind: 'block', type: 'control_wait_until' },
        { kind: 'block', type: 'control_repeat_until' },
        { kind: 'block', type: 'control_stop' },
        { kind: 'block', type: 'control_start_as_clone' },
        { kind: 'block', type: 'control_create_clone_of' },
        { kind: 'block', type: 'control_delete_this_clone' },
      ],
    },
    {
      kind: 'category',
      name: 'Sensing',
      categorystyle: 'sensing_category',
      contents: [
        { kind: 'block', type: 'sensing_touchingobject' },
        { kind: 'block', type: 'sensing_keypressed' },
        { kind: 'block', type: 'sensing_mousedown' },
        { kind: 'block', type: 'sensing_mousex' },
        { kind: 'block', type: 'sensing_mousey' },
        { kind: 'block', type: 'sensing_distanceto' },
        {
          kind: 'block',
          type: 'sensing_askandwait',
          inputs: { QUESTION: textShadow("What's your name?") },
        },
        { kind: 'block', type: 'sensing_answer' },
        { kind: 'block', type: 'sensing_timer' },
        { kind: 'block', type: 'sensing_resettimer' },
      ],
    },
    {
      kind: 'category',
      name: 'Operators',
      categorystyle: 'operators_category',
      contents: [
        { kind: 'block', type: 'operator_add', inputs: { NUM1: numShadow(1), NUM2: numShadow(2) } },
        {
          kind: 'block',
          type: 'operator_subtract',
          inputs: { NUM1: numShadow(10), NUM2: numShadow(3) },
        },
        {
          kind: 'block',
          type: 'operator_multiply',
          inputs: { NUM1: numShadow(4), NUM2: numShadow(5) },
        },
        {
          kind: 'block',
          type: 'operator_divide',
          inputs: { NUM1: numShadow(20), NUM2: numShadow(4) },
        },
        {
          kind: 'block',
          type: 'operator_random',
          inputs: { FROM: numShadow(1), TO: numShadow(10) },
        },
        { kind: 'block', type: 'operator_gt', inputs: { OPERAND1: textShadow(''), OPERAND2: numShadow(50) } },
        { kind: 'block', type: 'operator_lt', inputs: { OPERAND1: textShadow(''), OPERAND2: numShadow(50) } },
        {
          kind: 'block',
          type: 'operator_equals',
          inputs: { OPERAND1: textShadow(''), OPERAND2: numShadow(50) },
        },
        { kind: 'block', type: 'operator_and' },
        { kind: 'block', type: 'operator_or' },
        { kind: 'block', type: 'operator_not' },
        {
          kind: 'block',
          type: 'operator_join',
          inputs: { STRING1: textShadow('Score: '), STRING2: textShadow('100') },
        },
        { kind: 'block', type: 'operator_mod', inputs: { NUM1: numShadow(10), NUM2: numShadow(3) } },
        { kind: 'block', type: 'operator_round', inputs: { NUM: numShadow(3.7) } },
        { kind: 'block', type: 'operator_mathop', inputs: { NUM: numShadow(9) } },
      ],
    },
    {
      kind: 'category',
      name: 'Variables',
      categorystyle: 'data_category',
      contents: [
        { kind: 'block', type: 'data_variable' },
        { kind: 'block', type: 'data_setvariableto', inputs: { VALUE: numShadow(0) } },
        { kind: 'block', type: 'data_changevariableby', inputs: { VALUE: numShadow(1) } },
        { kind: 'block', type: 'data_showvariable' },
        { kind: 'block', type: 'data_hidevariable' },
      ],
    },
];

export type ScratchExtensionCategoryDef = Blockly.utils.toolbox.ToolboxItemInfo & {
  kind: 'category';
  name: string;
  categorystyle: string;
  contents: Blockly.utils.toolbox.ToolboxItemInfo[];
};

export const EXTENSION_TOOLBOX_CATEGORIES: Record<ExtensionId, ScratchExtensionCategoryDef> = {
  music: {
    kind: 'category',
    name: 'Music',
    categorystyle: 'music_category',
    contents: [
      { kind: 'block', type: 'music_playdrum', inputs: { BEATS: numShadow(0.25) } },
      { kind: 'block', type: 'music_rest', inputs: { BEATS: numShadow(0.25) } },
      { kind: 'block', type: 'music_playnote', inputs: { BEATS: numShadow(0.5) } },
      { kind: 'block', type: 'music_setinstrument' },
      { kind: 'block', type: 'music_settempo', inputs: { TEMPO: numShadow(120) } },
      { kind: 'block', type: 'music_changetempo', inputs: { TEMPO: numShadow(20) } },
      { kind: 'block', type: 'music_gettempo' },
    ],
  },
  pen: {
    kind: 'category',
    name: 'Pen',
    categorystyle: 'pen_category',
    contents: [
      { kind: 'block', type: 'pen_clear' },
      { kind: 'block', type: 'pen_stamp' },
      { kind: 'block', type: 'pen_pendown' },
      { kind: 'block', type: 'pen_penup' },
      { kind: 'block', type: 'pen_setpencolorto' },
      { kind: 'block', type: 'pen_changepenhueby', inputs: { HUE: numShadow(10) } },
      { kind: 'block', type: 'pen_setpensizeto', inputs: { SIZE: numShadow(4) } },
      { kind: 'block', type: 'pen_changepensizeby', inputs: { SIZE: numShadow(1) } },
      {
        kind: 'block',
        type: 'pen_setpentransparencyto',
        inputs: { TRANSPARENCY: numShadow(0) },
      },
    ],
  },
  tts: {
    kind: 'category',
    name: 'Text to Speech',
    categorystyle: 'tts_category',
    contents: [
      { kind: 'block', type: 'tts_speak', inputs: { TEXT: textShadow('Hello creator!') } },
      { kind: 'block', type: 'tts_setvoice' },
      { kind: 'block', type: 'tts_setlanguage' },
    ],
  },
  translate: {
    kind: 'category',
    name: 'Translate',
    categorystyle: 'translate_category',
    contents: [
      { kind: 'block', type: 'translate_gettext', inputs: { WORDS: textShadow('hello friend') } },
      { kind: 'block', type: 'translate_getviewerlanguage' },
    ],
  },
  video: {
    kind: 'category',
    name: 'Video Sensing',
    categorystyle: 'video_category',
    contents: [
      {
        kind: 'block',
        type: 'video_whenmotiongreaterthan',
        inputs: { THRESHOLD: numShadow(20) },
      },
      { kind: 'block', type: 'video_motion' },
      { kind: 'block', type: 'video_turn' },
      {
        kind: 'block',
        type: 'video_settransparency',
        inputs: { TRANSPARENCY: numShadow(50) },
      },
    ],
  },
  appui: {
    kind: 'category',
    name: 'App UI',
    categorystyle: 'appui_category',
    contents: [
      { kind: 'block', type: 'appui_when_clicked' },
      {
        kind: 'block',
        type: 'appui_set_text',
        inputs: { TEXT: textShadow('⭐ Stars: 10') },
      },
      { kind: 'block', type: 'appui_set_value', inputs: { VALUE: numShadow(50) } },
      { kind: 'block', type: 'appui_get_value' },
      { kind: 'block', type: 'appui_set_visible' },
      {
        kind: 'block',
        type: 'appui_create_button',
        inputs: { LABEL: textShadow('Click Me'), X: numShadow(0), Y: numShadow(-120) },
      },
      { kind: 'block', type: 'appui_toast', inputs: { MESSAGE: textShadow('Level Up! 🎉') } },
    ],
  },
  storage: {
    kind: 'category',
    name: 'Cloud Save',
    categorystyle: 'storage_category',
    contents: [
      {
        kind: 'block',
        type: 'storage_save',
        inputs: { VALUE: numShadow(100), KEY: textShadow('high_score') },
      },
      { kind: 'block', type: 'storage_load', inputs: { KEY: textShadow('high_score') } },
      { kind: 'block', type: 'storage_has_key', inputs: { KEY: textShadow('high_score') } },
      { kind: 'block', type: 'storage_delete_key', inputs: { KEY: textShadow('high_score') } },
      { kind: 'block', type: 'storage_clear' },
    ],
  },
  physics: {
    kind: 'category',
    name: '2D Physics',
    categorystyle: 'physics_category',
    contents: [
      { kind: 'block', type: 'physics_enable' },
      { kind: 'block', type: 'physics_set_gravity', inputs: { GRAVITY: numShadow(12) } },
      { kind: 'block', type: 'physics_jump', inputs: { POWER: numShadow(10) } },
      {
        kind: 'block',
        type: 'physics_set_velocity',
        inputs: { VX: numShadow(0), VY: numShadow(8) },
      },
      {
        kind: 'block',
        type: 'physics_push',
        inputs: { FX: numShadow(4), FY: numShadow(6) },
      },
      {
        kind: 'block',
        type: 'physics_set_bounciness',
        inputs: { BOUNCE: numShadow(65), FRICTION: numShadow(12) },
      },
      { kind: 'block', type: 'physics_on_ground' },
      { kind: 'block', type: 'physics_velocity' },
    ],
  },
  gamepad: {
    kind: 'category',
    name: 'Gamepad',
    categorystyle: 'gamepad_category',
    contents: [
      { kind: 'block', type: 'gamepad_show_virtual' },
      { kind: 'block', type: 'gamepad_when_button' },
      { kind: 'block', type: 'gamepad_button_down' },
      { kind: 'block', type: 'gamepad_axis' },
    ],
  },
  fx: {
    kind: 'category',
    name: 'Juice FX',
    categorystyle: 'fx_category',
    contents: [
      { kind: 'block', type: 'fx_particles', inputs: { COUNT: numShadow(20) } },
      { kind: 'block', type: 'fx_screenshake', inputs: { INTENSITY: numShadow(8) } },
      { kind: 'block', type: 'fx_flash' },
      { kind: 'block', type: 'fx_camera_zoom', inputs: { ZOOM: numShadow(125) } },
      {
        kind: 'block',
        type: 'fx_camera_pan',
        inputs: { X: numShadow(0), Y: numShadow(0) },
      },
      { kind: 'block', type: 'fx_camera_reset' },
    ],
  },
};

export function buildScratchToolbox(
  enabledExtensions: ExtensionId[] = ['appui', 'fx', 'pen']
): Blockly.utils.toolbox.ToolboxInfo {
  const uniqueIds = Array.from(new Set(enabledExtensions));
  const extCategories = uniqueIds
    .map((id) => EXTENSION_TOOLBOX_CATEGORIES[id])
    .filter((c): c is ScratchExtensionCategoryDef => Boolean(c));

  return {
    kind: 'categoryToolbox',
    contents: [...CORE_TOOLBOX_CATEGORIES, ...extCategories],
  };
}

export const SCRATCH_TOOLBOX_CONFIG: Blockly.utils.toolbox.ToolboxInfo = buildScratchToolbox([
  'appui',
  'fx',
  'pen',
]);
