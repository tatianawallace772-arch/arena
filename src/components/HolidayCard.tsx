import { upcomingHolidays, daysUntilHoliday } from '../lib/holidays';
import { mediumDate } from '../lib/dates';
import { Emoji } from './Emoji';
import { Sun } from '../lib/icons';

type Props = {
  onGoTo: (key: string) => void;
};

export default function HolidayCard({ onGoTo }: Props) {
  const upcoming = upcomingHolidays(new Date(), 4);
  return (
    <section className="card" aria-label="Upcoming holidays">
      <div className="card-head">
        <Sun size={16} />
        <h2>Coming up</h2>
        <span className="spacer" />
        <span className="pill">countdowns</span>
      </div>
      <div className="upcoming">
        {upcoming.map(({ key, holiday }) => {
          const d = daysUntilHoliday(key);
          return (
            <button className="upcoming-row" key={key} onClick={() => onGoTo(key)}>
              <span className="upcoming-emoji">
                <Emoji name={holiday.emoji} size={19} />
              </span>
              <span className="upcoming-main">
                <strong>{holiday.label}</strong>
                <span>{mediumDate(key)}</span>
              </span>
              <span className="upcoming-when">
                {d <= 0 ? 'today' : d === 1 ? 'tomorrow' : `${d} days`}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
