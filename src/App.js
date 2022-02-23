/* eslint-disable no-mixed-operators */
import React, { useState, useEffect }  from 'react';
import { DeckGL }  from 'deck.gl';
//import { ScatterplotLayer } from '@deck.gl/layers';
import { useNavigate, useLocation } from "react-router-dom";
import ReactMapGL, { NavigationControl, _MapContext as MapContext }  from "react-map-gl";
import nearestColor from 'nearest-color';
import ReactAudioPlayer from 'react-audio-player'
import * as d3 from 'd3';
import _ from 'lodash'
import { Drawer, Row, Col, Button } from 'antd'
import { useWindowWidth } from '@react-hook/window-size'

import noise from './assets/ES_CityStreet9.mp3'

import Tooltip from './Tooltip';
import Legend from './Legend'
import './App.css';
import Panel from './Panel'

// Set your mapbox access token here
const MAPBOX_ACCESS_TOKEN = 'pk.eyJ1IjoicGZjcm91c3NlIiwiYSI6ImNreWtycmJxOTI0dWUzMHFwOTNtdjk1OGUifQ.vaI6qrvOwkqWe5k8JhNYdg';
const MAPBOX_STYLE = 'mapbox://styles/pfcrousse/ckymrthcs8bs614qpadigs2os'

const locations = {
  paris: {
    longitude: 2.395, 
    latitude: 48.851, 
    zoom: 10.2, 
    bbox: [[2.0943827204,48.7117011393],[2.6588734805,49.035891562]],
    intro: <div>
      <h3>Noisy cities</h3>
      <p>Here is the description of this project for Paris.</p>
    </div>,
    sources: <div>
      <h3>Sources</h3>
      <p>Here are the sources and references</p>
    </div>
  },
  london: {
    longitude: -0.048, 
    latitude: 51.491, 
    zoom: 10, 
    bbox: [[-0.5945770815,51.2468407724],[0.3375120088,51.7292587128]],
    intro: <div>
      <h3>Noisy cities</h3>
      <p>Here is the description of this project for London.</p>
    </div>,
    sources: <div>
      <h3>Sources</h3>
      <p>Here are the sources and references</p>
    </div>
  },
  nyc: {
    longitude: -73.917, 
    latitude: 40.710, 
    zoom: 10, 
    bbox: [[-74.2740753571,40.4853136705],[-73.8192439591,40.8276099713]],
    intro: <div>
      <h3>Noisy cities</h3>
      <p>Here is the description of this project for NYC.</p>
    </div>,
    sources: <div>
      <h3>Sources</h3>
      <p>Here are the sources and references</p>
    </div>
  },
  bxl: {
    longitude: 4.3549, 
    latitude:50.8403, 
    zoom: 11.5, 
    bbox: [[4.2413799586,50.7615138085],[4.4939662716,50.9161092408]],
    intro: <div>
      <h3>Noisy cities</h3>
      <p>Here is the description of this project for Brussels.</p>
    </div>,
    sources: <div>
      <h3>Sources</h3>
      <p>Here are the sources and references</p>
    </div>
  }
}
// Viewport settings
const INITIAL_VIEW_STATE = {
  ...locations.paris,
  pitch: 0,
  bearing: 0,
  //transitionDuration: 3000,
  //transitionInterpolator: new FlyToInterpolator(),
};

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

  //Grey
  {
    value: -1,
    label: 'NA',
    color: '#d5d5d5'
  },
  {
    value: -2,
    label: 'NA',
    color: '#eef0f0'
  },
  // {
  //   value: -3,
  //   label: 'NA',
  //   color: '#737b7b'
  // },
  {
    value: -4,
    label: 'NA',
    color: '#ffffff'
  },
  {
    value: -5,
    label: 'NA',
    color: '#cccccc'
  },
  // {
  //   value: -6,
  //   label: 'NA',
  //   color: '#989e9f'
  // }
]

function App() {
  let mapRef;
  let location = useLocation();
  let navigate = useNavigate();
  let url = new URLSearchParams(location.search)
  const width = useWindowWidth()
  const [tooltip, setTooltip] = useState(null)
  const [volume, setVolume] = useState(0)
  const [muted, setMuted] = useState(true)
  const [openDrawer, setOpenDrawer] = useState(true)
  const [layers] = useState(null)
  const [city, setCity] = useState(url.get('city') || 'paris')
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);

  useEffect(() => {
    if(city && locations[city]) {
      const newViewState = {
        longitude: locations[city].longitude,
        latitude: locations[city].latitude,
        zoom: locations[city].zoom,
        pitch: 0,
        bearing: 0,
        //transitionDuration: 3000,
        //transitionInterpolator: new FlyToInterpolator(),
      }
      setViewState(newViewState)
      navigate('/?city='+city, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city]);

  const onViewStateChange = ({viewState}) => {
    viewState.longitude = Math.min(locations[city].bbox[1][0], Math.max(locations[city].bbox[0][0], viewState.longitude));
    viewState.latitude = Math.min(locations[city].bbox[1][1], Math.max(locations[city].bbox[0][1], viewState.latitude));
    viewState.zoom = Math.max(locations[city].zoom, viewState.zoom)
    return viewState;
  }

  const playNoise = () => {
    const audio = document.getElementById("noise-audio");
    audio.play();
  }

  const onMouseMove = (e) => {
    //https://stackoverflow.com/questions/57862383/how-to-get-the-color-of-pixels-on-mapbox
    if(mapRef) {
      const canvas = mapRef.getMap().getCanvas();
      const gl = canvas.getContext('webgl') || canvas.getContext('webgl2');
      if (gl) {
        const { pixel: [x, y], coordinate } = e;
        const devicePixelRatio = window.devicePixelRatio
        const data = new Uint8Array(4);
        const canvasX = x * devicePixelRatio;
        const canvasY = canvas.height - (y * devicePixelRatio);
        gl.readPixels(canvasX, canvasY, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, data);
        const [r, g, b, a] = data;
        const color = `rgba(${r}, ${g}, ${b}, ${a})`;
        
        const colors = _(steps)
          .keyBy('value')
          .mapValues('color')
          .value()
        const colorHex = `#${rgba2hex(color)}`
        const value = +nearestColor.from(colors)(colorHex).name;

        setTooltip(x === -1 && y === -1 ? null : { x, y, color, value })

        const volumeScale = d3.scaleLinear()
          .domain(d3.extent(steps, d => d.value > 0 ? d.value : null))
          .range([0.1, 1])

        setVolume((x === -1 && y === -1) || value < 0 ? 0 : volumeScale(value))
        
        computeLayers((x === -1 && y === -1) || value < 0 ? null : coordinate, [r, g, b])
      }
    }
  }

  const computeLayers = (coordinates, color) => {
    if(!coordinates) return null;
    /*const layer = new ScatterplotLayer({
      id: 'scatterplot-layer',
      data: [coordinates],
      pickable: false,
      opacity: 0.8,
      stroked: true,
      filled: true,
      radiusScale: 6,
      radiusMinPixels: 8,
      radiusMaxPixels: 8,
      lineWidthMinPixels: 3,
      getPosition: d => d,
      getRadius: d => 8,
      getFillColor: d => color,
      getLineColor: d => [255, 255, 255]
    });

    setLayers([layer]);*/
  }

  const rgba2hex = (orig) => {
    let rgb = orig.replace(/\s/g, '').match(/^rgba?\((\d+),(\d+),(\d+),?([^,\s)]+)?/i)
    let hex = rgb ?
      (rgb[1] | 1 << 8).toString(16).slice(1) +
      (rgb[2] | 1 << 8).toString(16).slice(1) +
      (rgb[3] | 1 << 8).toString(16).slice(1) : orig;
  
    return hex;
  }

  return (
    <div>
      <Row style={{ position: 'relative', width: '100vw', overflow: 'hidden' }}>
        <Col span={width < 900 ? 24 : 6} style={{ padding: 16, height: '100vh' }}>
          <Panel setCity={setCity} city={city} intro={locations[city].intro} sources={locations[city].sources}/>
        </Col>
        <Col span={width < 900 ? 24 : 18} style={{ height: width < 900 ? '90vh' : '100vh'}}>
          <DeckGL
          controller={true}
          layers={layers}
          initialViewState={viewState}
          onHover={onMouseMove}
          getCursor={() => "crosshair"}
          ContextProvider={MapContext.Provider}
          onDragStart={() => setTooltip({ ...tooltip, x: -1000, y: -1000})}
          onViewStateChange={onViewStateChange}
        >
          <ReactMapGL
            reuseMaps
            mapboxApiAccessToken={MAPBOX_ACCESS_TOKEN}
            preventStyleDiffing
            mapStyle={MAPBOX_STYLE}
            ref={map => {mapRef = map}}
            preserveDrawingBuffer={true}
          >
          </ReactMapGL>
          <Tooltip data={tooltip} />
          <div style={{ position: "absolute", right: 30, top: 30 }}>
            <NavigationControl />
          </div>
          <div>
            <ReactAudioPlayer
              id="noise-audio"
              src={noise}
              //controls
              autoPlay
              autoplay
              muted={muted}
              volume={volume}
              loop
            />
          </div>
          <div style={{ position: "absolute", right: 10, bottom: 0, width: 300 }}>
            <Legend muted={muted} setMuted={setMuted} value={tooltip && tooltip.value}/>
          </div>
        </DeckGL>
        {/* <div style={{ position: "absolute", left: '5vw', top: '5vh', width: '100vw', pointerEvents: 'none', textShadow: '-1px -1px 0 white, 1px -1px 0 white, -1px 1px 0 white, 1px 1px 0 white'}}>
          <div style={{ fontSize: '10vh', fontFamily: 'Poppins, sans-serif' }}>Noisy City</div>
          <div style={{ fontSize: '2vh' }}>
            <div>Audible data visualization on Brussels noise pollution.</div>
            <div>Crank up the volume and mouse over the city.</div>
          </div>
        </div> */}
        </Col>
      </Row>
      <Drawer
          title="Volume On"
          placement="bottom"
          closable={false}
          visible={openDrawer}
        >
          <p>This data visualization is an experiment aiming at making you feel and hear the noise pollution in various cities.</p>
          <p>If you want to experience the sound just crank your volume up and click on the "With sound" button.</p>
          <Row type="flex" gutter={8} justify="end" style={{ marginBottom: 24 }}>
            <Button type="default" onClick={() => {setOpenDrawer(false);}}>Without sound</Button>
            <Button style={{ marginLeft: 8}} type="primary" onClick={() => {setOpenDrawer(false); setMuted(false); playNoise();}}>With sound</Button>
          </Row>  
      </Drawer>
    </div>
  );
}

export default App;
