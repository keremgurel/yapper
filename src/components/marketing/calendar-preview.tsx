"use client";

import MonthView from "@/components/calendar/month-view";
import CalendarPostChip from "@/components/calendar/calendar-post-chip";
import { dayKey } from "@/lib/content/calendar";
import { demoIdeas } from "./demo-content";

const noop = () => {};
const focus = new Date(2026, 9, 1);
const items = demoIdeas.map((idea, index) => ({
  ...idea,
  scheduledFor: new Date(2026, 9, 5 + index * 2, 10).toISOString(),
}));
const byDay = new Map(
  items.map((item) => [dayKey(new Date(item.scheduledFor)), [item]]),
);

export default function CalendarPreview() {
  return (
    <div
      className="calendar-only-demo"
      role="img"
      aria-label="October content plan: four projects placed on dates, with their production status preserved. Planning dates do not automatically publish posts."
    >
      <div aria-hidden="true">
        <div className="studio-panel-heading">
          <p className="demo-heading">October 2026</p>
          <span>Content plan</span>
        </div>
        <div className="calendar-demo-month" inert>
          <MonthView
            focus={focus}
            today={focus}
            byDay={byDay}
            onOpenItem={noop}
            onDropDay={noop}
          />
        </div>
        <div className="calendar-demo-agenda" inert>
          {items.map((item, i) => (
            <div key={item.id}>
              <time>Oct {5 + i * 2}</time>
              <CalendarPostChip item={item} onOpen={noop} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
