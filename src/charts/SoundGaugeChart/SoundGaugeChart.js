import Chart from '../chart';
import * as d3 from 'd3';

import './SoundGaugeChart.css'

const steps = [
  {
    value: 35,
    label: '< 40',
    color: '#feebe2',//'#65c099'
  },
  {
    value: 40,
    label: '40',
    color: '#fdd0ce',//'#65c099'
  },
  {
    value: 45,
    label: '45',
    color: '#fbb4b9',//'#98cfa7'
  },
  {
    value: 50,
    label: '50',
    color: '#f98ead',//'#cbdfb5'
  },
  {
    value: 55,
    label: '55',
    color: '#f768a1',//'#feeec3'
  },
  {
    value: 60,
    label: '60',
    color: '#de4196',//'#eeb5b0'
  },
  {
    value: 65,
    label: '65',
    color: '#c51b8a',//'#de7c9e'
  },
  {
    value: 70,
    label: '70',
    color: '#a00e81',//'#ce448b'
  },
  {
    value: 75,
    label: '75',
    color: '#7a0177',//'#be0b78'
  },
]

export default class SparkLineChart extends Chart {

  create() {
    this.svg = super.createRoot();

    this.main = this.svg.append('g')
      .attr('class', 'main')
      .attr('transform', `translate(${this.props.width/2}, ${this.props.width/2})`);

    this.gauge = this.main.append('g')
      .attr('class', 'gauge')

    const size = this.props.width * 0.85
    this.gaugePin = this.main.append('g')
      .attr('class', 'gaugePin')
    
    this.gaugePin 
      .append('path')
      .attr("transform", `translate(0, ${- size * 0.4})`)
      .attr('d', d3.symbol().type(d3.symbolTriangle))
      .attr('fill', 'black')
      .style('opacity', 1)  

    this.gaugeLabel = this.main.append('text')
      .attr('class', 'gaugeLabel')
  }

  update(state) {
    this.drawChart(state);
  }

  drawChart(state) { 
    const size = this.props.width * 0.85

    const pie = d3.pie()
      .padAngle(0.015)
      //.sort(d => d.value)
      .startAngle(-Math.PI * 0.6)
      .endAngle(Math.PI * 0.6)
      .value(1)

    const arcs = pie(steps);
    const radius = size / 2;
    const arc = d3.arc()
      .innerRadius(radius * 0.8)
      .outerRadius(radius - 1);

    if(state.value) {
      const a = arcs.find(d => d.data.value === state.value)
      if(a) {
        const angle = (a.startAngle + a.endAngle) / 2
        this.gaugePin
          .transition()
          .style('opacity', 1)
          .attr("transform", `rotate(${angle * (180/Math.PI)})`)
       
        this.gaugeLabel
          .attr('font-size', size * 0.2)
          .attr('text-anchor', 'middle')
          .style('opacity', 1)
          .text(`${a.data.label} dB`)
      } else {
        this.gaugePin
          .transition()
          .style('opacity', 0)

        this.gaugeLabel
          //.transition()
          .style('opacity', 0)
      }
    } else{
      this.gaugePin
        .style('opacity', 0)

      this.gaugeLabel
        .style('opacity', 0)
    }

    this.gauge.selectAll("path")
      .data(arcs)
      .join("path")
        .attr("fill", d => d.data.color)
        .attr("d", arc);

    this.gauge.selectAll("text")
      .data(arcs.slice(1,arcs.length))
      .enter()
      .append("g")
        .attr("class", "tick-label")
        .append("text")
          .attr("transform", d =>
            `translate(${size * 0.55 * Math.sin(d.startAngle)},
                      ${- size * 0.55 * Math.cos(d.startAngle)})
              rotate(${d.startAngle})`)
          .attr("dy", "0.35em")
          .attr("text-anchor", "middle")
          .attr("font-size", size * 0.05)
          .text(d => d.data.label);
  }
}