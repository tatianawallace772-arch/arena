import { type BlocklyBlockNode, getInputBlock, getTopBlocks } from './astTypes';
import type { SpriteModel } from '../types/studio';

function evalExprJS(node: BlocklyBlockNode | undefined): string {
  if (!node) return '0';
  const f = node.fields ?? {};
  switch (node.type) {
    case 'math_number_scratch':
      return String(f.NUM ?? 0);
    case 'text_scratch':
      return JSON.stringify(String(f.TEXT ?? ''));
    case 'motion_xposition':
      return 'sprite.x';
    case 'motion_yposition':
      return 'sprite.y';
    case 'motion_direction':
      return 'sprite.direction';
    case 'looks_size':
      return 'sprite.size';
    case 'looks_costumename':
      return 'sprite.costumeName';
    case 'sensing_touchingobject':
      return `sprite.isTouching(${JSON.stringify(String(f.TOUCHINGOBJECTMENU ?? '_mouse_'))})`;
    case 'sensing_keypressed':
      return `stage.isKeyPressed(${JSON.stringify(String(f.KEY_OPTION ?? ' '))})`;
    case 'sensing_mousedown':
      return 'stage.mouseDown';
    case 'sensing_mousex':
      return 'stage.mouseX';
    case 'sensing_mousey':
      return 'stage.mouseY';
    case 'sensing_distanceto':
      return `sprite.distanceTo(${JSON.stringify(String(f.DISTANCETOMENU ?? '_mouse_'))})`;
    case 'sensing_answer':
      return 'stage.answer';
    case 'sensing_timer':
      return 'stage.timer';
    case 'data_variable':
      return `vars[${JSON.stringify(String(f.VARIABLE ?? 'score'))}]`;
    case 'appui_get_value':
      return `ui.getValue(${JSON.stringify(String(f.WIDGET ?? 'widget'))})`;
    case 'music_gettempo':
      return 'music.tempo';
    case 'translate_gettext':
      return `translate.text(${evalExprJS(getInputBlock(node, 'WORDS'))}, ${JSON.stringify(String(f.LANG ?? 'es'))})`;
    case 'translate_getviewerlanguage':
      return 'translate.viewerLanguage';
    case 'video_motion':
      return `video.get(${JSON.stringify(String(f.ATTRIBUTE ?? 'motion'))}, ${JSON.stringify(String(f.SUBJECT ?? 'stage'))})`;
    case 'storage_load':
      return `cloudSave.load(${evalExprJS(getInputBlock(node, 'KEY'))})`;
    case 'storage_has_key':
      return `cloudSave.hasKey(${evalExprJS(getInputBlock(node, 'KEY'))})`;
    case 'physics_on_ground':
      return 'sprite.physics.onGround';
    case 'physics_velocity':
      return `sprite.physics.${String(f.AXIS ?? 'vx')}`;
    case 'gamepad_button_down':
      return `gamepad.isPressed(${JSON.stringify(String(f.BUTTON ?? 'A'))})`;
    case 'gamepad_axis':
      return `gamepad.axis(${JSON.stringify(String(f.AXIS ?? 'horizontal'))})`;
    case 'operator_add':
      return `(${evalExprJS(getInputBlock(node, 'NUM1'))} + ${evalExprJS(getInputBlock(node, 'NUM2'))})`;
    case 'operator_subtract':
      return `(${evalExprJS(getInputBlock(node, 'NUM1'))} - ${evalExprJS(getInputBlock(node, 'NUM2'))})`;
    case 'operator_multiply':
      return `(${evalExprJS(getInputBlock(node, 'NUM1'))} * ${evalExprJS(getInputBlock(node, 'NUM2'))})`;
    case 'operator_divide':
      return `(${evalExprJS(getInputBlock(node, 'NUM1'))} / ${evalExprJS(getInputBlock(node, 'NUM2'))})`;
    case 'operator_mod':
      return `(${evalExprJS(getInputBlock(node, 'NUM1'))} % ${evalExprJS(getInputBlock(node, 'NUM2'))})`;
    case 'operator_random':
      return `stage.random(${evalExprJS(getInputBlock(node, 'FROM'))}, ${evalExprJS(getInputBlock(node, 'TO'))})`;
    case 'operator_gt':
      return `(${evalExprJS(getInputBlock(node, 'OPERAND1'))} > ${evalExprJS(getInputBlock(node, 'OPERAND2'))})`;
    case 'operator_lt':
      return `(${evalExprJS(getInputBlock(node, 'OPERAND1'))} < ${evalExprJS(getInputBlock(node, 'OPERAND2'))})`;
    case 'operator_equals':
      return `(${evalExprJS(getInputBlock(node, 'OPERAND1'))} == ${evalExprJS(getInputBlock(node, 'OPERAND2'))})`;
    case 'operator_and':
      return `(${evalExprJS(getInputBlock(node, 'OPERAND1'))} && ${evalExprJS(getInputBlock(node, 'OPERAND2'))})`;
    case 'operator_or':
      return `(${evalExprJS(getInputBlock(node, 'OPERAND1'))} || ${evalExprJS(getInputBlock(node, 'OPERAND2'))})`;
    case 'operator_not':
      return `!(${evalExprJS(getInputBlock(node, 'OPERAND'))})`;
    case 'operator_join':
      return `String(${evalExprJS(getInputBlock(node, 'STRING1'))}) + String(${evalExprJS(getInputBlock(node, 'STRING2'))})`;
    case 'operator_round':
      return `Math.round(${evalExprJS(getInputBlock(node, 'NUM'))})`;
    case 'operator_mathop':
      return `Math.${String(f.OPERATOR ?? 'abs')}(${evalExprJS(getInputBlock(node, 'NUM'))})`;
    default:
      return '0';
  }
}

function emitStackJS(first: BlocklyBlockNode | undefined, indent: string): string {
  const lines: string[] = [];
  let cur = first;
  while (cur) {
    const f = cur.fields ?? {};
    switch (cur.type) {
      case 'motion_movesteps':
        lines.push(`${indent}sprite.move(${evalExprJS(getInputBlock(cur, 'STEPS'))});`);
        break;
      case 'motion_turnright':
        lines.push(`${indent}sprite.turnRight(${evalExprJS(getInputBlock(cur, 'DEGREES'))});`);
        break;
      case 'motion_turnleft':
        lines.push(`${indent}sprite.turnLeft(${evalExprJS(getInputBlock(cur, 'DEGREES'))});`);
        break;
      case 'motion_gotoxy':
        lines.push(`${indent}sprite.goTo(${evalExprJS(getInputBlock(cur, 'X'))}, ${evalExprJS(getInputBlock(cur, 'Y'))});`);
        break;
      case 'motion_goto':
        lines.push(`${indent}sprite.goToTarget(${JSON.stringify(String(f.TO ?? '_random_'))});`);
        break;
      case 'motion_glidesecstoxy':
        lines.push(
          `${indent}await sprite.glide(${evalExprJS(getInputBlock(cur, 'SECS'))}, ${evalExprJS(getInputBlock(cur, 'X'))}, ${evalExprJS(getInputBlock(cur, 'Y'))});`
        );
        break;
      case 'motion_pointindirection':
        lines.push(`${indent}sprite.pointInDirection(${Number(f.DIRECTION ?? 90)});`);
        break;
      case 'motion_pointtowards':
        lines.push(`${indent}sprite.pointTowards(${JSON.stringify(String(f.TOWARDS ?? '_mouse_'))});`);
        break;
      case 'motion_changexby':
        lines.push(`${indent}sprite.x += ${evalExprJS(getInputBlock(cur, 'DX'))};`);
        break;
      case 'motion_setx':
        lines.push(`${indent}sprite.x = ${evalExprJS(getInputBlock(cur, 'X'))};`);
        break;
      case 'motion_changeyby':
        lines.push(`${indent}sprite.y += ${evalExprJS(getInputBlock(cur, 'DY'))};`);
        break;
      case 'motion_sety':
        lines.push(`${indent}sprite.y = ${evalExprJS(getInputBlock(cur, 'Y'))};`);
        break;
      case 'motion_ifonedgebounce':
        lines.push(`${indent}sprite.ifOnEdgeBounce();`);
        break;
      case 'motion_setrotationstyle':
        lines.push(`${indent}sprite.rotationStyle = ${JSON.stringify(String(f.STYLE ?? 'all around'))};`);
        break;
      case 'looks_sayforsecs':
        lines.push(
          `${indent}await sprite.sayForSecs(${evalExprJS(getInputBlock(cur, 'MESSAGE'))}, ${evalExprJS(getInputBlock(cur, 'SECS'))});`
        );
        break;
      case 'looks_say':
        lines.push(`${indent}sprite.say(${evalExprJS(getInputBlock(cur, 'MESSAGE'))});`);
        break;
      case 'looks_thinkforsecs':
        lines.push(
          `${indent}await sprite.thinkForSecs(${evalExprJS(getInputBlock(cur, 'MESSAGE'))}, ${evalExprJS(getInputBlock(cur, 'SECS'))});`
        );
        break;
      case 'looks_switchcostumeto':
        lines.push(`${indent}sprite.switchCostume(${JSON.stringify(String(f.COSTUME ?? ''))});`);
        break;
      case 'looks_nextcostume':
        lines.push(`${indent}sprite.nextCostume();`);
        break;
      case 'looks_switchbackdropto':
        lines.push(`${indent}stage.switchBackdrop(${JSON.stringify(String(f.BACKDROP ?? ''))});`);
        break;
      case 'looks_nextbackdrop':
        lines.push(`${indent}stage.nextBackdrop();`);
        break;
      case 'looks_changesizeby':
        lines.push(`${indent}sprite.size += ${evalExprJS(getInputBlock(cur, 'CHANGE'))};`);
        break;
      case 'looks_setsizeto':
        lines.push(`${indent}sprite.size = ${evalExprJS(getInputBlock(cur, 'SIZE'))};`);
        break;
      case 'looks_changeeffectby':
        lines.push(
          `${indent}sprite.effects[${JSON.stringify(String(f.EFFECT ?? 'color'))}] += ${evalExprJS(getInputBlock(cur, 'CHANGE'))};`
        );
        break;
      case 'looks_seteffectto':
        lines.push(
          `${indent}sprite.effects[${JSON.stringify(String(f.EFFECT ?? 'color'))}] = ${evalExprJS(getInputBlock(cur, 'VALUE'))};`
        );
        break;
      case 'looks_cleargraphiceffects':
        lines.push(`${indent}sprite.clearEffects();`);
        break;
      case 'looks_show':
        lines.push(`${indent}sprite.visible = true;`);
        break;
      case 'looks_hide':
        lines.push(`${indent}sprite.visible = false;`);
        break;
      case 'sound_play':
        lines.push(`${indent}audio.startSound(${JSON.stringify(String(f.SOUND ?? 'magic'))});`);
        break;
      case 'sound_playuntildone':
        lines.push(`${indent}await audio.playSoundUntilDone(${JSON.stringify(String(f.SOUND ?? 'magic'))});`);
        break;
      case 'sound_playnote':
        lines.push(
          `${indent}await audio.playNote(${Number(f.NOTE ?? 60)}, ${evalExprJS(getInputBlock(cur, 'BEATS'))});`
        );
        break;
      case 'sound_speak':
        lines.push(`${indent}await audio.speak(${evalExprJS(getInputBlock(cur, 'TEXT'))});`);
        break;
      case 'sound_setvolumeto':
        lines.push(`${indent}audio.setVolume(${evalExprJS(getInputBlock(cur, 'VOLUME'))});`);
        break;
      case 'sound_stopallsounds':
        lines.push(`${indent}audio.stopAll();`);
        break;
      case 'event_broadcast':
        lines.push(`${indent}stage.broadcast(${JSON.stringify(String(f.MESSAGE ?? 'message1'))});`);
        break;
      case 'event_broadcastandwait':
        lines.push(`${indent}await stage.broadcastAndWait(${JSON.stringify(String(f.MESSAGE ?? 'message1'))});`);
        break;
      case 'control_wait':
        lines.push(`${indent}await stage.wait(${evalExprJS(getInputBlock(cur, 'DURATION'))});`);
        break;
      case 'control_repeat': {
        const body = emitStackJS(getInputBlock(cur, 'SUBSTACK'), indent + '  ');
        lines.push(`${indent}for (let i = 0; i < ${evalExprJS(getInputBlock(cur, 'TIMES'))}; i++) {\n${body}\n${indent}  await stage.nextFrame();\n${indent}}`);
        break;
      }
      case 'control_forever': {
        const body = emitStackJS(getInputBlock(cur, 'SUBSTACK'), indent + '  ');
        lines.push(`${indent}while (stage.isRunning) {\n${body}\n${indent}  await stage.nextFrame();\n${indent}}`);
        break;
      }
      case 'control_if': {
        const body = emitStackJS(getInputBlock(cur, 'SUBSTACK'), indent + '  ');
        lines.push(`${indent}if (${evalExprJS(getInputBlock(cur, 'CONDITION'))}) {\n${body}\n${indent}}`);
        break;
      }
      case 'control_if_else': {
        const b1 = emitStackJS(getInputBlock(cur, 'SUBSTACK'), indent + '  ');
        const b2 = emitStackJS(getInputBlock(cur, 'SUBSTACK2'), indent + '  ');
        lines.push(`${indent}if (${evalExprJS(getInputBlock(cur, 'CONDITION'))}) {\n${b1}\n${indent}} else {\n${b2}\n${indent}}`);
        break;
      }
      case 'control_wait_until':
        lines.push(`${indent}while (!(${evalExprJS(getInputBlock(cur, 'CONDITION'))})) await stage.nextFrame();`);
        break;
      case 'control_repeat_until': {
        const body = emitStackJS(getInputBlock(cur, 'SUBSTACK'), indent + '  ');
        lines.push(`${indent}while (!(${evalExprJS(getInputBlock(cur, 'CONDITION'))})) {\n${body}\n${indent}  await stage.nextFrame();\n${indent}}`);
        break;
      }
      case 'control_stop':
        lines.push(`${indent}stage.stop(${JSON.stringify(String(f.STOP_OPTION ?? 'all'))});`);
        break;
      case 'control_create_clone_of':
        lines.push(`${indent}stage.createClone(${JSON.stringify(String(f.CLONE_OPTION ?? '_myself_'))});`);
        break;
      case 'control_delete_this_clone':
        lines.push(`${indent}sprite.deleteClone();`);
        break;
      case 'sensing_askandwait':
        lines.push(`${indent}await stage.ask(${evalExprJS(getInputBlock(cur, 'QUESTION'))});`);
        break;
      case 'sensing_resettimer':
        lines.push(`${indent}stage.resetTimer();`);
        break;
      case 'data_setvariableto':
        lines.push(
          `${indent}vars[${JSON.stringify(String(f.VARIABLE ?? 'score'))}] = ${evalExprJS(getInputBlock(cur, 'VALUE'))};`
        );
        break;
      case 'data_changevariableby':
        lines.push(
          `${indent}vars[${JSON.stringify(String(f.VARIABLE ?? 'score'))}] += Number(${evalExprJS(getInputBlock(cur, 'VALUE'))});`
        );
        break;
      case 'data_showvariable':
        lines.push(`${indent}stage.showVariable(${JSON.stringify(String(f.VARIABLE ?? 'score'))});`);
        break;
      case 'data_hidevariable':
        lines.push(`${indent}stage.hideVariable(${JSON.stringify(String(f.VARIABLE ?? 'score'))});`);
        break;
      case 'pen_clear':
        lines.push(`${indent}pen.clear();`);
        break;
      case 'pen_stamp':
        lines.push(`${indent}pen.stamp(sprite);`);
        break;
      case 'pen_pendown':
        lines.push(`${indent}sprite.penDown = true;`);
        break;
      case 'pen_penup':
        lines.push(`${indent}sprite.penDown = false;`);
        break;
      case 'pen_setpencolorto':
        lines.push(`${indent}sprite.penColor = ${JSON.stringify(String(f.COLOR ?? '#7C3AED'))};`);
        break;
      case 'pen_changepenhueby':
        lines.push(`${indent}sprite.penHue += ${evalExprJS(getInputBlock(cur, 'HUE'))};`);
        break;
      case 'pen_setpensizeto':
        lines.push(`${indent}sprite.penSize = ${evalExprJS(getInputBlock(cur, 'SIZE'))};`);
        break;
      case 'pen_changepensizeby':
        lines.push(`${indent}sprite.penSize += ${evalExprJS(getInputBlock(cur, 'SIZE'))};`);
        break;
      case 'pen_setpentransparencyto':
        lines.push(`${indent}sprite.penTransparency = ${evalExprJS(getInputBlock(cur, 'TRANSPARENCY'))};`);
        break;
      case 'music_playdrum':
        lines.push(
          `${indent}await music.playDrum(${JSON.stringify(String(f.DRUM ?? 'snare'))}, ${evalExprJS(getInputBlock(cur, 'BEATS'))});`
        );
        break;
      case 'music_rest':
        lines.push(`${indent}await music.rest(${evalExprJS(getInputBlock(cur, 'BEATS'))});`);
        break;
      case 'music_playnote':
        lines.push(
          `${indent}await music.playNote(${Number(f.NOTE ?? 60)}, ${evalExprJS(getInputBlock(cur, 'BEATS'))});`
        );
        break;
      case 'music_setinstrument':
        lines.push(`${indent}music.setInstrument(${JSON.stringify(String(f.INSTRUMENT ?? 'piano'))});`);
        break;
      case 'music_settempo':
        lines.push(`${indent}music.tempo = ${evalExprJS(getInputBlock(cur, 'TEMPO'))};`);
        break;
      case 'music_changetempo':
        lines.push(`${indent}music.tempo += ${evalExprJS(getInputBlock(cur, 'TEMPO'))};`);
        break;
      case 'tts_speak':
        lines.push(`${indent}await tts.speak(${evalExprJS(getInputBlock(cur, 'TEXT'))});`);
        break;
      case 'tts_setvoice':
        lines.push(`${indent}tts.setVoice(${JSON.stringify(String(f.VOICE ?? 'alto'))});`);
        break;
      case 'tts_setlanguage':
        lines.push(`${indent}tts.setLanguage(${JSON.stringify(String(f.LANG ?? 'en-US'))});`);
        break;
      case 'video_turn':
        lines.push(`${indent}video.setMode(${JSON.stringify(String(f.STATE ?? 'on'))});`);
        break;
      case 'video_settransparency':
        lines.push(`${indent}video.setTransparency(${evalExprJS(getInputBlock(cur, 'TRANSPARENCY'))});`);
        break;
      case 'storage_save':
        lines.push(
          `${indent}cloudSave.save(${evalExprJS(getInputBlock(cur, 'KEY'))}, ${evalExprJS(getInputBlock(cur, 'VALUE'))});`
        );
        break;
      case 'storage_delete_key':
        lines.push(`${indent}cloudSave.deleteKey(${evalExprJS(getInputBlock(cur, 'KEY'))});`);
        break;
      case 'storage_clear':
        lines.push(`${indent}cloudSave.clear();`);
        break;
      case 'physics_enable':
        lines.push(`${indent}sprite.physics.setMode(${JSON.stringify(String(f.MODE ?? 'dynamic'))});`);
        break;
      case 'physics_set_gravity':
        lines.push(`${indent}stage.physics.gravity = ${evalExprJS(getInputBlock(cur, 'GRAVITY'))};`);
        break;
      case 'physics_set_velocity':
        lines.push(
          `${indent}sprite.physics.setVelocity(${evalExprJS(getInputBlock(cur, 'VX'))}, ${evalExprJS(getInputBlock(cur, 'VY'))});`
        );
        break;
      case 'physics_jump':
        lines.push(`${indent}sprite.physics.jump(${evalExprJS(getInputBlock(cur, 'POWER'))});`);
        break;
      case 'physics_push':
        lines.push(
          `${indent}sprite.physics.impulse(${evalExprJS(getInputBlock(cur, 'FX'))}, ${evalExprJS(getInputBlock(cur, 'FY'))});`
        );
        break;
      case 'physics_set_bounciness':
        lines.push(
          `${indent}sprite.physics.setMaterial(${evalExprJS(getInputBlock(cur, 'BOUNCE'))}, ${evalExprJS(getInputBlock(cur, 'FRICTION'))});`
        );
        break;
      case 'gamepad_show_virtual':
        lines.push(`${indent}gamepad.showOverlay(${f.STATE !== 'hide'});`);
        break;
      case 'fx_flash':
        lines.push(`${indent}fx.flash(${JSON.stringify(String(f.COLOR ?? '#FFFFFF'))});`);
        break;
      case 'fx_camera_zoom':
        lines.push(`${indent}stage.camera.setZoom(${evalExprJS(getInputBlock(cur, 'ZOOM'))});`);
        break;
      case 'fx_camera_pan':
        lines.push(
          `${indent}stage.camera.panTo(${evalExprJS(getInputBlock(cur, 'X'))}, ${evalExprJS(getInputBlock(cur, 'Y'))});`
        );
        break;
      case 'fx_camera_reset':
        lines.push(`${indent}stage.camera.reset();`);
        break;
      case 'appui_set_text':
        lines.push(
          `${indent}ui.setLabel(${JSON.stringify(String(f.WIDGET ?? ''))}, ${evalExprJS(getInputBlock(cur, 'TEXT'))});`
        );
        break;
      case 'appui_set_value':
        lines.push(
          `${indent}ui.setValue(${JSON.stringify(String(f.WIDGET ?? ''))}, ${evalExprJS(getInputBlock(cur, 'VALUE'))});`
        );
        break;
      case 'appui_set_visible':
        lines.push(
          `${indent}ui.setVisible(${JSON.stringify(String(f.WIDGET ?? ''))}, ${f.VISIBILITY !== 'hide'});`
        );
        break;
      case 'appui_create_button':
        lines.push(
          `${indent}ui.createButton(${JSON.stringify(String(f.ID ?? 'btn'))}, ${evalExprJS(getInputBlock(cur, 'LABEL'))}, ${evalExprJS(getInputBlock(cur, 'X'))}, ${evalExprJS(getInputBlock(cur, 'Y'))});`
        );
        break;
      case 'appui_toast':
        lines.push(`${indent}ui.toast(${evalExprJS(getInputBlock(cur, 'MESSAGE'))});`);
        break;
      case 'fx_particles':
        lines.push(
          `${indent}fx.burst(${JSON.stringify(String(f.KIND ?? 'stars'))}, ${evalExprJS(getInputBlock(cur, 'COUNT'))}, sprite.x, sprite.y);`
        );
        break;
      case 'fx_screenshake':
        lines.push(`${indent}fx.screenShake(${evalExprJS(getInputBlock(cur, 'INTENSITY'))});`);
        break;
      default:
        lines.push(`${indent}// ${cur.type}`);
    }
    cur = cur.next?.block;
  }
  return lines.join('\n') || `${indent}// (add blocks here)`;
}

export function generateSpriteJavaScript(sprite: SpriteModel): string {
  const topBlocks = getTopBlocks(sprite.workspaceState);
  if (topBlocks.length === 0) {
    return `// Sprite: ${sprite.name}\n// Drag Scratch blocks from the Google Blockly palette on the left!`;
  }
  const sections: string[] = [
    `// Generated by Google Blockly v13.5 (Zelos Scratch Engine)`,
    `// Sprite: "${sprite.name}"`,
    ``,
  ];

  for (const top of topBlocks) {
    const f = top.fields ?? {};
    const body = emitStackJS(top.next?.block, '  ');
    switch (top.type) {
      case 'event_whenflagclicked':
        sections.push(`sprite.onGreenFlag(async () => {\n${body}\n});\n`);
        break;
      case 'event_whenkeypressed':
        sections.push(`stage.onKeyPressed(${JSON.stringify(String(f.KEY ?? ' '))}, async () => {\n${body}\n});\n`);
        break;
      case 'event_whenthisspriteclicked':
        sections.push(`sprite.onClick(async () => {\n${body}\n});\n`);
        break;
      case 'event_whenbroadcastreceived':
        sections.push(`stage.onBroadcast(${JSON.stringify(String(f.MESSAGE ?? 'message1'))}, async () => {\n${body}\n});\n`);
        break;
      case 'control_start_as_clone':
        sections.push(`sprite.onCloneStart(async (sprite) => {\n${body}\n});\n`);
        break;
      case 'appui_when_clicked':
        sections.push(`ui.onButtonClick(${JSON.stringify(String(f.WIDGET ?? 'btn'))}, async () => {\n${body}\n});\n`);
        break;
      case 'video_whenmotiongreaterthan':
        sections.push(
          `video.onMotionGreaterThan(${evalExprJS(getInputBlock(top, 'THRESHOLD'))}, async () => {\n${body}\n});\n`
        );
        break;
      case 'gamepad_when_button':
        sections.push(
          `gamepad.onButtonPressed(${JSON.stringify(String(f.BUTTON ?? 'A'))}, async () => {\n${body}\n});\n`
        );
        break;
      default:
        // Loose stack preview
        sections.push(`// Unattached stack:\nasync function snippet() {\n${emitStackJS(top, '  ')}\n}\n`);
    }
  }
  return sections.join('\n');
}

export function generateProjectPython(sprites: SpriteModel[]): string {
  const out: string[] = [
    `# Generated by BlockCraft Scratch + Google Blockly Studio`,
    `from blockcraft_runtime import Stage, Sprite, AppUI`,
    ``,
    `stage = Stage()`,
    `ui = AppUI(stage)`,
    ``,
  ];
  for (const sp of sprites) {
    const safeName = sp.name.toLowerCase().replace(/[^a-z0-9_]+/g, '_') || 'sprite';
    out.push(`${safeName} = stage.add_sprite(${JSON.stringify(sp.name)}, x=${Math.round(sp.x)}, y=${Math.round(sp.y)}, size=${sp.size})`);
    const topBlocks = getTopBlocks(sp.workspaceState);
    let idx = 1;
    for (const top of topBlocks) {
      const f = top.fields ?? {};
      if (top.type === 'event_whenflagclicked') {
        out.push(`\n@${safeName}.when_green_flag_clicked\ndef on_start_${idx}(sprite):`);
      } else if (top.type === 'event_whenkeypressed') {
        out.push(`\n@${safeName}.when_key_pressed(${JSON.stringify(String(f.KEY ?? ' '))})\ndef on_key_${idx}(sprite):`);
      } else if (top.type === 'event_whenthisspriteclicked') {
        out.push(`\n@${safeName}.when_clicked\ndef on_click_${idx}(sprite):`);
      } else if (top.type === 'appui_when_clicked') {
        out.push(`\n@ui.when_button_clicked(${JSON.stringify(String(f.WIDGET ?? 'btn'))})\ndef on_ui_${idx}():`);
      } else if (top.type === 'video_whenmotiongreaterthan') {
        out.push(
          `\n@video.when_motion_greater_than(${evalExprJS(getInputBlock(top, 'THRESHOLD'))})\ndef on_video_${idx}(sprite):`
        );
      } else if (top.type === 'gamepad_when_button') {
        out.push(
          `\n@gamepad.when_button_pressed(${JSON.stringify(String(f.BUTTON ?? 'A'))})\ndef on_pad_${idx}(sprite):`
        );
      } else {
        continue;
      }
      idx++;
      const jsBody = emitStackJS(top.next?.block, '    ')
        .replace(/await /g, '')
        .replace(/;/g, '')
        .replace(/for \(let i = 0 i < (.*?) i\+\+\) \{/g, 'for i in range(int($1)):')
        .replace(/while \((.*?)\) \{/g, 'while $1:')
        .replace(/if \((.*?)\) \{/g, 'if $1:')
        .replace(/\} else \{/g, 'else:')
        .replace(/\}/g, '')
        .replace(/true/g, 'True')
        .replace(/false/g, 'False');
      const cleaned = jsBody
        .split('\n')
        .filter((l) => l.trim().length > 0)
        .join('\n');
      out.push(cleaned || '    pass');
    }
    out.push('');
  }
  out.push(`stage.run()`);
  return out.join('\n');
}
