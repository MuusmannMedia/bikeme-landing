import test from 'node:test';
import assert from 'node:assert/strict';
import {readingTop,readingIntent,type ReadingPosition} from '../lib/conversation-position';
const reading:ReadingPosition={top:315,bottom:false,anchor:'visible-message',offset:-17};
test('prepending older, variable-height messages keeps the same partially visible message',()=>{assert.equal(readingTop(reading,{height:5000,viewport:475,anchorTop:1832}),1849);});
test('incoming messages below an older reading position do not pull it to the bottom',()=>{assert.equal(readingTop(reading,{height:8000,viewport:475,anchorTop:298}),315);});
test('a missing or removed anchor falls back to the old position and clamps after removal',()=>{assert.equal(readingTop(reading,{height:8000,viewport:475,anchorTop:null}),315);assert.equal(readingTop(reading,{height:600,viewport:475,anchorTop:null}),125);});
test('a reader at the bottom follows new messages, including a changed viewport height',()=>{assert.equal(readingTop({...reading,bottom:true},{height:5000,viewport:620,anchorTop:298}),4380);});
test('the explicit new-messages action overrides an older reading anchor',()=>{assert.equal(readingTop(reading,{height:5000,viewport:475,anchorTop:298},true),4525);});
test('short histories never produce a negative scroll position',()=>{assert.equal(readingTop(reading,{height:200,viewport:475,anchorTop:0}),0);});

test('retry clicks and editing keys may change focus but must not discard a saved reading anchor',()=>{assert.equal(readingIntent('pointerdown'),'focus');assert.equal(readingIntent('keydown','ArrowLeft',true),'focus');assert.equal(readingIntent('keydown','Home',true),'focus');});
test('deliberate wheel, touch and reading keys cancel automatic page restoration',()=>{assert.equal(readingIntent('wheel'),'scroll');assert.equal(readingIntent('touchmove'),'scroll');assert.equal(readingIntent('keydown','PageDown',false),'scroll');});
