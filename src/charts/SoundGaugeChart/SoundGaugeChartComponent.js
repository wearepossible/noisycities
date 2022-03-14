import React, {Component} from 'react';
import ReactDOM from 'react-dom';
import SoundGaugeChart from './SoundGaugeChart.js';

class SoundGaugeChartComponent extends Component {

  constructor(props) {
    super(props);
    this.state = this.getInitialState();

    this.createChart = this.createChart.bind(this);
  }

  getInitialState() {
    return {
      chart: null
    };
  }

  componentDidMount() {
    // First render of the D3 chart.
    this.createChart();
    // Re-render from scratch on each resize.
    window.addEventListener('resize', this.createChart);
  }

  UNSAFE_componentWillReceiveProps(nextProps){
    var currentState = this.getChartState(nextProps);
    if(this.state.chart){
      this.state.chart.update(currentState);
    }
  }

  createChart() {
    const el = ReactDOM.findDOMNode(this.refs.chart);

    if (this.state.chart) {
      this.state.chart.destroy();
    }

    const margin = {
      top: 5,
      right: 5,
      bottom: 5,
      left: 5
    };

    const elWidth = this.props.width || el.clientWidth;
    const elHeight = elWidth * 0.7;

    const props = {
      margin: margin,
      width: elWidth - margin.left - margin.right,
      height: elHeight - margin.top - margin.bottom
    };

    // Initialise the chart, then render it without transitions.
    this.setState({
      chart: new SoundGaugeChart(el, props)
    }, function() {
      this.state.chart.create();
      this.state.chart.update(this.getChartState(this.props));
      this.state.chart.preventTransitions();
    });
  }

  getChartState(props) {
    return {
      value: props.value,
    };
  }

  // Tear down the chart and remove the listener.
  componentWillUnmount() {
    //TODO understand why this isn't needed
    //this.state.chart.destroy();
    window.removeEventListener('resize', this.createChart);
  }

  render() {
    return (
      <div ref='chart'></div>
    );
  }
};

export default SoundGaugeChartComponent;