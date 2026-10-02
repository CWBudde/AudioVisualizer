import {seeded, TAU} from './choreography';
export const Background = ({t, ceiling}: {t: number; ceiling: number}) => <g>
  <rect width="1080" height="1080" fill="url(#background)"/>
  <g opacity={.12 + ceiling * .07} stroke="#414865" strokeWidth=".6">
    {Array.from({length: 9}, (_, i) => <path key={i} d={`M ${108 + i * 108} 0 V 1080 M 0 ${108 + i * 108} H 1080`}/>)}
  </g>
  {Array.from({length: 100}, (_, i) => {
    const x = seeded(i + 300) * 1080, y = seeded(i + 500) * 1080;
    return <circle key={i} cx={x} cy={y} r={i % 8 === 0 ? 1.5 : .8} fill={i % 3 === 0 ? '#8658FF' : '#809CC5'} opacity={.12 + .15 * (.5 + .5 * Math.sin(t * .35 + seeded(i) * TAU))}/>;
  })}
  <path d="M 108 145 V 108 H 145 M 935 108 H 972 V 145 M 108 935 V 972 H 145 M 935 972 H 972 V 935" stroke="#36E5FF" opacity=".22" strokeWidth="1.2" fill="none"/>
</g>;
