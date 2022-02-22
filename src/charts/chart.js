import { select, timerFlush } from 'd3';

/**
 * Abstract class for a D3 chart.
 */
export default class Chart {

  constructor(el, props) {
      this.el = el;
      this.props = props;
  }

  /**
   * To override. Creates the initial rendering of the chart.
   */
  create() {}

  /**
   * Creates the root-level SVG element.
   * @return {object} D3 SVG root.
   */
  createRoot() {
      const {width, height, margin} = this.props;

      const svg = select(this.el).append('svg')
          .attr('class', 'chart')
          .attr('width', width + margin.left + margin.right)
          .attr('height', height + margin.top + margin.bottom)
          .append('g')
          .attr('transform', `translate(${margin.left}, ${margin.top})`);

      return svg;
  }

  /**
   * To override. Populates the initial renderings with content.
   */
  update() {}

  /**
   * To use to flush out D3 transitions.
   */
  preventTransitions() {
      const now = Date.now;
      Date.now = () => Infinity;
      timerFlush();
      Date.now = now;
  }

  /**
   * Can be overriden. Destroys the rendered SVG.
   */
  destroy() {
      select(this.el).selectAll('svg').remove();
  }
}