import * as moment from 'moment';

import { ipcRenderer } from 'electron';

import React, { useEffect, useState } from 'react';
import { Icon } from '@blueprintjs/core';
import { DatePicker } from '@blueprintjs/datetime';

import { Index } from 'sse/storage/query';
import { PaneHeader } from 'sse/renderer/widgets';
import { request } from 'sse/api/renderer';

import { DateStamp } from 'renderer/widgets/dates';
import { HelpButton } from 'renderer/widgets/help-button';
import { WindowToaster } from 'renderer/toaster';
import { ScheduledIssue } from 'models/issues';

import { IssueDraft, ScheduleForm } from './schedule-form';
import { UpcomingIssues } from './upcoming';

import * as styles from './styles.scss';


const DEFAULT_MAX_DATE: Date = moment().add(1, 'years').toDate();


export const IssueScheduler: React.FC<{}> = function () {
  const [schedule, updateSchedule] = useState([] as ScheduledIssue[]);
  const [issueIndex, updateIssueIndex] = useState({} as Index<ScheduledIssue>);
  const [currentIssue, setCurrentIssue] = useState({ id: null } as { id: number | null });
  const [date, selectDate] = useState(new Date());
  const [month, selectMonth] = useState(new Date());
  const [hoveredDate, hoverDate] = useState(null as Date | null);
  const [newIssueDraft, updateNewIssueDraft] = useState(null as IssueDraft | null);
  const [daySchedule, updateDaySchedule] = useState(null as ScheduledIssue | null);
  const [minDate, setMinDate] = useState(undefined as Date | undefined);
  const [maxDate, setMaxDate] = useState(DEFAULT_MAX_DATE);
  const [userIsEditing, setUserIsEditing] = useState(true);

  function startOrUpdateDraft(withDate: Date) {
    if (newIssueDraft !== null) {
      // We are in the process of scheduling new issue
      const draft = newIssueDraft as IssueDraft;

      if (!draft.cutoff_date) {
        updateNewIssueDraft({ ...newIssueDraft, cutoff_date: withDate });
      } else if (!draft.publication_date) {
        updateNewIssueDraft({ ...newIssueDraft, publication_date: withDate });
      }
    } else {
      updateNewIssueDraft({ id: undefined, cutoff_date: withDate });
    }
  }

  useEffect(() => {
    fetchCurrentIssue();
    fetchSchedule();
    ipcRenderer.once('app-loaded', fetchCurrentIssue);
    ipcRenderer.once('app-loaded', fetchSchedule);
    ipcRenderer.on('update-current-issue', fetchCurrentIssue);
    return function cleanup() {
      ipcRenderer.removeListener('app-loaded', fetchCurrentIssue);
      ipcRenderer.removeListener('app-loaded', fetchSchedule);
      ipcRenderer.removeListener('update-current-issue', fetchCurrentIssue);
    };
  }, []);

  useEffect(() => {
    setUserIsEditing(false);
    fetchSchedule();
  }, [month]);

  useEffect(() => {
    if (newIssueDraft !== null) {
      const draft = newIssueDraft as IssueDraft;
      setMaxDate(draft.publication_date || DEFAULT_MAX_DATE);
      setMinDate(draft.cutoff_date);
    } else {
      setMaxDate(DEFAULT_MAX_DATE);
      setMinDate(undefined);
    }
  }, [newIssueDraft]);

  useEffect(() => {
    if (hoveredDate !== null && newIssueDraft === null) {
      updateDaySchedule(getDaySchedule(hoveredDate as Date, schedule));
    }
  }, [hoveredDate]);


  /* Storage API utilities */

  async function fetchSchedule() {
    const scheduledIssues = await request<Index<ScheduledIssue>>('ob-schedule', { month });
    updateSchedule(Object.values(scheduledIssues));
    updateIssueIndex(scheduledIssues);
    setTimeout(() => { setUserIsEditing(true) }, 1000);
  }

  async function fetchCurrentIssue() {
    console.debug('oi', 'fetching');
    const currentIssue = await request<{ id: number | null }>('current-issue-id');
    //setLoading(false);
    setCurrentIssue(currentIssue);
  }

  async function saveNewSchedule() {
    if (newIssueDraft && newIssueDraft.publication_date && newIssueDraft.cutoff_date) {
      const draft = newIssueDraft as ScheduledIssue;
      try {
        await request<{ success: boolean }>('ob-schedule-add', { newData: draft });
      } catch (e) {
        for (const msg of e.errorMessageList) {
          WindowToaster.show({
            message: msg,
            intent: 'warning',
            icon: 'warning-sign',
          });
        }
        return;
      }
      updateNewIssueDraft(null);
      await ipcRenderer.send('scheduled-new-issue', {});
      await fetchSchedule();
    }
  }

  return (
    <div className={styles.issueSchedulerBase}>
      <div className={styles.issueScheduler}>
        <div className={styles.calendarPane}>
          <PaneHeader align="right" major={true} actions={<HelpButton path="schedule/" />} />

          <div className={styles.paneBody}>
            <DatePicker
              modifiers={{
                isPublicationDate: (date) => getIssueWithPublication(date, schedule) !== null,
                isCutoffDate: (date) => getIssueWithCutoff(date, schedule) !== null,
                isNewPublicationDate: (date) => (
                  (newIssueDraft || {} as IssueDraft).publication_date
                  ? moment((newIssueDraft as IssueDraft).publication_date).isSame(date, 'day') : false),
                isNewCutoffDate: (date) => (
                  (newIssueDraft || {} as IssueDraft).cutoff_date
                  ? moment((newIssueDraft as IssueDraft).cutoff_date).isSame(date, 'day') : false),
              }}
              dayPickerProps={{
                onDayMouseEnter: (date) => hoverDate(date),
                onDayMouseLeave: () => hoverDate(null),
                showOutsideDays: false,
              }}
              minDate={minDate}
              maxDate={maxDate}
              value={date}
              onChange={(newDate, isUserChange) => {
                if (isUserChange) { startOrUpdateDraft(newDate || date); }
                if (newDate !== null) { selectDate(newDate); }
                if (!moment(newDate).isSame(date, 'month')) { selectMonth(newDate); }
              }}
            />

            {hoveredDate
              ? <div className={styles.daySchedule}>
                  {!newIssueDraft || !newIssueDraft.cutoff_date
                    ? <p>
                        <Icon icon="edit" />
                        &nbsp;
                        {newIssueDraft
                          ? <>Click to&nbsp;schedule the</>
                          : <>Click to&nbsp;schedule an&nbsp;edition with</>}&nbsp;<strong className={styles.cutDateLabel}>cutoff&nbsp;date</strong> on&nbsp;<DateStamp date={hoveredDate as Date} />.
                      </p>
                    : null}

                  {newIssueDraft && !newIssueDraft.publication_date && moment(hoveredDate).isAfter(minDate)
                    ? <p>
                        <Icon icon="edit" />
                        &nbsp;
                        Click to&nbsp;schedule
                        the&nbsp;<strong className={styles.pubDateLabel}>publication&nbsp;date</strong> on&nbsp;<DateStamp date={hoveredDate as Date} />.
                      </p>
                    : null}

                  {newIssueDraft && newIssueDraft.publication_date && newIssueDraft.cutoff_date
                    ? <p>
                        <Icon icon="arrow-right" />
                        &nbsp;
                        Fill&nbsp; edition details and&nbsp;save the&nbsp;new&nbsp;schedule.
                      </p>
                    : null}

                  {daySchedule && !newIssueDraft
                    ? <p>
                        <Icon icon="info-sign" />
                        &nbsp;
                        Something is already scheduled on this day.
                      </p>
                    : null}
                </div>
              : null}

              {!hoveredDate && !newIssueDraft
                ? <div className={styles.daySchedule}>
                    <p>
                      <Icon icon="info-sign" />
                      &nbsp;
                      Select a&nbsp;month to&nbsp;view&nbsp;OB&nbsp;schedule for&nbsp;that&nbsp;time&nbsp;period.
                    </p>
                  </div>
                : null}

              {!hoveredDate && newIssueDraft && newIssueDraft.publication_date && newIssueDraft.cutoff_date
                ? <div className={styles.daySchedule}>
                    <p>
                      <Icon icon="arrow-right" />
                      &nbsp;
                      Fill&nbsp; edition details and&nbsp;save the&nbsp;new&nbsp;schedule.
                    </p>
                  </div>
                : null}
          </div>
        </div>

        {newIssueDraft
          ? <div className={styles.selectedDayPane}>
              <PaneHeader align="left" major={true}>Schedule bulletin edition</PaneHeader>

              <div className={styles.paneBody}>
                <ScheduleForm
                  draft={newIssueDraft as IssueDraft}
                  onChange={updateNewIssueDraft}
                  onSave={saveNewSchedule}
                  onCancel={() => { updateNewIssueDraft(null) }}
                />
              </div>
            </div>
          : <div className={styles.upcomingIssuesPane}>
              <PaneHeader align="left" major={true}>Bulletin editions</PaneHeader>

              <div className={styles.paneBody}>
                <UpcomingIssues
                  issues={issueIndex}
                  userIsEditing={userIsEditing}
                  currentIssueId={currentIssue.id || undefined} />
              </div>
            </div>
        }
      </div>
    </div>
  );
};


function getDaySchedule(forDate: Date, issues: ScheduledIssue[]): ScheduledIssue | null {
  return getIssueWithPublication(forDate, issues) || getIssueWithCutoff(forDate, issues);
}

function getIssueWithPublication(onDate: Date, issues: ScheduledIssue[]): ScheduledIssue | null {
  return issues.find(i => moment(i.publication_date).isSame(onDate, 'day')) || null;
}

function getIssueWithCutoff(onDate: Date, issues: ScheduledIssue[]): ScheduledIssue | null {
  return issues.find(i => moment(i.cutoff_date).isSame(onDate, 'day')) || null;
}
