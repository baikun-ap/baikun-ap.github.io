import { curveNatural } from 'd3-shape';
import AppleActivityCard, { type ActivityData } from '@/components/kokonutui/apple-activity-card';
import { AreaChart } from '@/components/charts/area-chart';
import { Area } from '@/components/charts/area';
import { Grid } from '@/components/charts/grid';
import { ReferenceArea } from '@/components/charts/reference-area';
import { XAxis } from '@/components/charts/x-axis';
import { ChartTooltip } from '@/components/charts/tooltip';
import { addDays, today } from '../lib/date';
import { useCourseCtx } from './ui';
import { t } from '../i18n';

/**
 * Today's activity rings (Kokonut UI's Apple Activity Card) and the last 12
 * days of answers (a Bklit area chart in its Studio configuration). Loaded
 * lazily: the charting code stays out of the first paint.
 */
export default function StudyActivity() {
  const { state } = useCourseCtx();
  const day = today();
  const activities: ActivityData[] = [
    { label: t('ОТВЕТЫ', 'ANSWERS'), color: '#FF2D55', colorEnd: '#FF6B8B', size: 200, current: state.days[day] ?? 0, target: 50, unit: t('ШТ', 'QTY') },
    { label: t('КАРТОЧКИ', 'CARDS'), color: '#A3F900', colorEnd: '#C5FF4D', size: 160, current: state.reviews?.[day] ?? 0, target: 20, unit: t('ШТ', 'QTY') },
    { label: t('СЕРИЯ', 'STREAK'), color: '#04C7DD', colorEnd: '#4DDFED', size: 120, current: state.streak, target: 7, unit: t('ДН', 'DAYS') },
  ];

  // The chart's shape, mapped to real data: desktop = every answer that day, mobile = the right ones.
  const chartData = Array.from({ length: 12 }, (_, i) => {
    const d = addDays(day, i - 11);
    const [y, m, dd] = d.split('-').map(Number);
    return { date: new Date(y, m - 1, dd), desktop: state.days[d] ?? 0, mobile: state.right?.[d] ?? 0 };
  });

  return (
    <section className="bk activity">
      <div className="panel">
        <AppleActivityCard title={t('Активность сегодня', 'Today’s activity')} titleAs="h2" activities={activities} />
      </div>
      <div className="panel bk-chart">
        <div className="row between">
          <h2 className="h3">{t('Ответы за 12 дней', 'Answers, last 12 days')}</h2>
          <p className="small muted bk-key"><i style={{ background: 'var(--chart-1)' }} />desktop — {t('все ответы', 'all answers')} <i style={{ background: 'var(--chart-2)' }} />mobile — {t('верные', 'correct')}</p>
        </div>
        <AreaChart data={chartData}
          animationDuration={1100}
          animationEasing="cubic-bezier(0.85, 0, 0.15, 1)">
          <Grid horizontal />
          <ReferenceArea y1={160} y2={220} fill="color-mix(in oklch, var(--chart-foreground-muted) 15%, transparent)" fillOpacity={1} pattern="none" patternColor="var(--chart-foreground-muted)" stroke="var(--chart-foreground-muted)" strokeStyle="dashed" strokeDasharray="4,4" fadeEdges={true} fadeEdgesLength={10} axisLabelColor="var(--chart-1)" showMarkers={true} markerColor="var(--chart-1)" yAxisId="left" />
          <Area dataKey="desktop" curve={curveNatural} fillOpacity={0.3} strokeWidth={2} fadeEdges={{ left: 15, right: 15 }} fadeBottom={100} showLine={true} showHighlight={true} />
          <Area dataKey="mobile" fill="var(--chart-2)" curve={curveNatural} fillOpacity={0.3} strokeWidth={2} fadeEdges={{ left: 15, right: 15 }} fadeBottom={100} showLine={true} showHighlight={true} />
          <XAxis />
          <ChartTooltip />
        </AreaChart>
      </div>
    </section>
  );
}
