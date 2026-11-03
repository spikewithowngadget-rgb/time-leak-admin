// @vitest-environment jsdom
import {readFileSync} from 'node:fs';
import {afterEach,expect,it,vi} from 'vitest';

const api=vi.hoisted(()=>({getReminderSettings:vi.fn(),updateReminderSettings:vi.fn(),getReminderStatus:vi.fn()}));
vi.mock('../../web/assets/js/api.js',()=>api);
vi.mock('../../web/assets/js/auth.js',()=>({redirectToLogin:vi.fn()}));
afterEach(()=>vi.unstubAllGlobals());

it('loads global settings and saves a validated schedule without sending email',async()=>{
  const storage=new Map();
  vi.stubGlobal('localStorage',{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,String(value)),removeItem:key=>storage.delete(key),clear:()=>storage.clear()});
  const settings={enabled:true,days_before:3,send_hour:9,timezone:'Asia/Almaty'};
  api.getReminderSettings.mockResolvedValue(settings);
  api.getReminderStatus.mockResolvedValue({sender_configured:true,verified_contacts:2,pending:1,sent:4,failed:0,cancelled:0});
  api.updateReminderSettings.mockImplementation(async value=>value);
  const html=readFileSync(`${process.cwd()}/../web/index.html`,'utf8');
  const documentSource=new DOMParser().parseFromString(html,'text/html');
  const root=documentSource.querySelector('[data-view="settings"]').cloneNode(true);
  root.hidden=false;document.body.appendChild(root);
  const {mountReminderSettings,activateReminderSettings}=await import('../../web/assets/js/reminders.js');
  const {setLanguage}=await import('../../web/assets/js/i18n.js');
  setLanguage('en');
  mountReminderSettings(root);activateReminderSettings();
  const fieldset=root.querySelector('#reminder-settings-fields');
  await vi.waitFor(()=>expect(fieldset.disabled).toBe(false));
  expect(root.querySelector('#reminder-schedule-summary').textContent).toContain('3, 2 and 1');
  expect(root.querySelector('#reminder-status-counts').children).toHaveLength(5);
  const preset=root.querySelector('#reminder-days-preset');
  preset.value='30';preset.dispatchEvent(new Event('change'));
  root.querySelector('#reminder-send-hour').value='18';
  root.querySelector('#reminder-timezone').value='UTC';
  root.querySelector('#reminder-enabled').checked=false;
  expect(api.updateReminderSettings).not.toHaveBeenCalled();
  const form=root.querySelector('#reminder-settings-form');
  form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
  await vi.waitFor(()=>expect(api.updateReminderSettings).toHaveBeenCalledExactlyOnceWith({enabled:false,days_before:30,send_hour:18,timezone:'UTC'}));
  await vi.waitFor(()=>expect(fieldset.disabled).toBe(false));
  preset.value='custom';preset.dispatchEvent(new Event('change'));
  root.querySelector('#reminder-custom-days').value='31';
  form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
  expect(api.updateReminderSettings).toHaveBeenCalledTimes(1);
  expect(root.querySelector('#reminder-feedback').textContent).toContain('1–30');
  expect(api.getReminderSettings).toHaveBeenCalledTimes(1);
  expect(api.getReminderStatus).toHaveBeenCalledTimes(2);
  setLanguage('ru');
  expect(root.querySelector('#reminder-schedule-summary').textContent).toContain('приостановлены');
  expect(api.updateReminderSettings).toHaveBeenCalledTimes(1);
});
