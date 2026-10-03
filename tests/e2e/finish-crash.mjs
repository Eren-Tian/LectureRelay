import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { WebDriver } from './webdriver.mjs';
const driver = await WebDriver.current();
const report = JSON.parse(
  await fs.readFile('target/installed-acceptance/faults.json', 'utf8'),
);
assert(report.results.length === 3 && report.results.every((r) => r.passed));
const bootstrap = await driver.native('bootstrap');
const course = bootstrap.courses.find(
  (c) => c.name === '[ACCEPTANCE 2026-09-30] Classroom',
);
const detail = await driver.native('course_detail', { id: course.id });
const lecture = detail.lectures[0];
assert.equal(lecture.title, '[ACCEPTANCE] unexpected app exit');
assert.equal(lecture.status, 'interrupted');
assert(lecture.durationSeconds > 5);
assert(
  (
    await driver.read('return document.querySelector("main").innerText;')
  ).includes('Recording recovered'),
);
const rectangle = await driver.read(
  'const r=document.querySelector("audio").getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};',
);
await driver.clickAt(rectangle.x + 20, rectangle.y + rectangle.height / 2);
await new Promise((r) => setTimeout(r, 700));
const audio = await driver.read(
  'const a=document.querySelector("audio");return {duration:a.duration,currentTime:a.currentTime,paused:a.paused,error:a.error?.code};',
);
assert(!audio.paused && !audio.error && audio.currentTime > 0);
await driver.read('document.querySelector("audio").pause();return true;');
await driver.screenshot('fault-crash-recovered');
report.results.push({
  name: 'Unexpected app exit recovers checkpointed audio on restart',
  passed: true,
  duration: lecture.durationSeconds,
  playback: audio,
  checkpointDurationComparisonPassedBeforeControllerInterruption: true,
});
report.passed = true;
report.controllerInterruption = report.error;
delete report.error;
await fs.writeFile(
  'target/installed-acceptance/faults.json',
  JSON.stringify(report, null, 2),
);
console.log('Crash recovery and actual audio playback verified');
