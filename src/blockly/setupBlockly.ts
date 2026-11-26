import * as Blockly from 'blockly';
import { registerContinuousToolbox } from '@blockly/continuous-toolbox';
import { FieldColour, registerFieldColour } from '@blockly/field-colour';
import { FieldAngle, registerFieldAngle } from '@blockly/field-angle';

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
  pen_category: { colour: '#0FBD8C' },
  appui_category: { colour: '#FF6680' },
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
}

function numShadow(n: number) {
  return { shadow: { type: 'math_number_scratch', fields: { NUM: n } } };
}

function textShadow(t: string) {
  return { shadow: { type: 'text_scratch', fields: { TEXT: t } } };
}

export const SCRATCH_TOOLBOX_CONFIG: Blockly.utils.toolbox.ToolboxInfo = {
  kind: 'categoryToolbox',
  contents: [
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
    {
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
      ],
    },
    {
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
    {
      kind: 'category',
      name: 'Juice FX',
      categorystyle: 'fx_category',
      contents: [
        { kind: 'block', type: 'fx_particles', inputs: { COUNT: numShadow(20) } },
        { kind: 'block', type: 'fx_screenshake', inputs: { INTENSITY: numShadow(8) } },
      ],
    },
  ],
};
