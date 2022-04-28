/* eslint-disable no-mixed-operators */
import React, { useState, useEffect } from 'react';
import { DeckGL } from 'deck.gl';
//import { ScatterplotLayer } from '@deck.gl/layers';
import { useNavigate, useLocation } from "react-router-dom";
import ReactMapGL, { NavigationControl, _MapContext as MapContext } from "react-map-gl";
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
import 'mapbox-gl/dist/mapbox-gl.css';
import {
  TwitterShareButton,
  FacebookShareButton,
  LinkedinShareButton,
  FacebookIcon,
  LinkedinIcon,
  TwitterIcon,
} from "react-share";

// Set your mapbox access token here
const MAPBOX_ACCESS_TOKEN = 'pk.eyJ1IjoicGZjcm91c3NlIiwiYSI6ImNreWtycmJxOTI0dWUzMHFwOTNtdjk1OGUifQ.vaI6qrvOwkqWe5k8JhNYdg';
const MAPBOX_STYLE = 'mapbox://styles/pfcrousse/ckymrthcs8bs614qpadigs2os'

const shareUrl = 'https://www.carfreemegacities.org/noise-pollution'
const shareText = `Noise pollution is one of the biggest threats to environmental health in Europe. 
Don't cover your ears. Find out just how noisy our cities are with this new interactive map 👇`
const shareTextFr = `La pollution sonore est l'une des plus grandes menaces pour la santé environnementale en Europe.
Ne couvrez pas vos oreilles. Découvrez à quel point nos villes sont bruyantes grâce à cette carte interactive 👇`
const intro1En = <div>
  <p>Our noise maps show the levels of exposure to noise in London, Paris and New York.</p> <p>Use your mouse to explore the loudest and quietest spots.</p> <p>We’ve created this to help people learn more about noise pollution in these megacities.</p>
</div>
const intro1Fr = <div>
  <p>Notre carte du bruit montre le niveau d'exposition au bruit dans les villes de Londres, Paris et New York.</p><p>Utilisez votre souris pour explorer les coins les plus calmes ainsi que les plus bruyants.</p> <p>Ce travail a été conçu dans le but de rendre perceptible la pollution sonore dans ces mégapoles.</p>
</div>
const intro2En = <div>
  <div>Like what you see? Share it on:<br /><Row align="top"><span style={{ marginRight: 8 }}></span> <TwitterShareButton url={shareUrl} title={shareText + ' via @_wearepossible'}><TwitterIcon size={32} round={true} /></TwitterShareButton> <FacebookShareButton url={shareUrl} quote={shareText + ' via @wearepossibleuk'}><FacebookIcon size={32} round={true} /></FacebookShareButton> <LinkedinShareButton url={shareUrl} title={shareText + ' via https://www.linkedin.com/company/wearepossible/'}><LinkedinIcon size={32} round={true} /></LinkedinShareButton> </Row></div>
  <p>Want more like this? Sign up to our <a href="https://www.carfreemegacities.org/noise-pollution" target="_blank" rel="noopener noreferrer"> mailing list</a>.</p>
</div>
const intro2Fr = <div>
  {/* <p>Like what you see? Share it on: <TwitterShareButton url={shareUrl} title={shareText}><TwitterIcon size={32} round={true} /></TwitterShareButton> <FacebookShareButton url={shareUrl} quote={shareText}><FacebookIcon size={32} round={true} /></FacebookShareButton> <LinkedinShareButton url={shareUrl} title={shareText}><LinkedinIcon size={32} round={true} /></LinkedinShareButton> </p> */}
  <div>Appréciez-vous ce contenu? Partagez le sur:<br /><Row align="top"><span style={{ marginRight: 8 }}></span> <TwitterShareButton url={shareUrl} title={shareTextFr + ' via @_wearepossible'}><TwitterIcon size={32} round={true} /></TwitterShareButton> <FacebookShareButton url={shareUrl} quote={shareTextFr + ' via @wearepossibleuk'}><FacebookIcon size={32} round={true} /></FacebookShareButton> <LinkedinShareButton url={shareUrl} title={shareTextFr + ' via https://www.linkedin.com/company/wearepossible/'}><LinkedinIcon size={32} round={true} /></LinkedinShareButton></Row> </div>
  <p>Vous en voulez plus? Abonnez vous à notre <a href="https://www.carfreemegacities.org/noise-pollution" target="_blank" rel="noopener noreferrer"> newsletter</a>.</p>
</div>

const outroEn = <p style={{ textAlign: 'center' }}>These sonifications build on <br /> <a href="https://noisy-city.jetpack.ai/" target="_blank" rel="noopener noreferrer">Karim Douieb's original Noisy City map of Brussels</a>.</p>
const outroFr = <p style={{ textAlign: 'center' }}>Cette représentation auditive des données est construite sur base du travail de <a href="https://noisy-city.jetpack.ai/" target="_blank" rel="noopener noreferrer">Karim Douieb avec sa carte du bruit de Brussels</a>.</p>

const locations = {
  paris: {
    longitude: 2.395,
    latitude: 48.851,
    zoom: 10.2,
    bbox: [[2.0943827204, 48.7117011393], [2.6588734805, 49.035891562]],
    sourcesFr: <div>
      <p>Il est à noter que les décibels ne suivent pas une échelle linéaire. Une augmentation de 10 décibels est ressenti comme un doublement du volume. Par exemple, 80 décibels est quatre fois plus fort que 60 décibels.</p>
      {/* <p>Zoomez sur la carte pour obtenir plus de détails sur une ville. Cliquez sur les boutons ci-dessous pour accéder aux autres villes.</p> */}
      <p><span style={{ fontWeight: 'bold' }}>Sources des données</span>: <a href="https://carto.bruitparif.fr/" target="_blank" rel="noopener noreferrer">Bruitparif</a>. Les données sont extraites depuis les stations <a href="https://rumeur.bruitparif.fr/main" target="_blank" rel="noopener noreferrer">Rumeur network</a>. Les mesures intermédiaires sont extrapolées et validées avec les données collectées. <a href="https://www.bruitparif.fr/pages/En-tete/700%20Accompagner/800%20CSB%20en%20IdF/680%20Une%20m%C3%A9thodologie%20rigoureuse/2018-08-21%20-%20M%C3%A9thologie%20d'%C3%A9laboration%20des%20cartes%20strat%C3%A9giques%20de%20bruit%20de%203%C3%A8me%20%C3%A9ch%C3%A9ance%20(2017)%20en%20%C3%8Ele-de-France.pdf" target="_blank" rel="noopener noreferrer">Information sur la méthodologie</a></p>
      <p>Il s'agit de la troisième itération (cycle de 5 années) de récolte de données imposée par la directive européenne sur le bruit environnemental. Les données sont du type ‘Lden’ (24 heures 7/7, jour et soir), le niveau de bruit moyen concerne le trafic routier seulement (ce qui explique les zones de faible bruit aux alentours des gares et des aéroports).</p>
    </div>,
    sourcesEn: <div>
      <p>Remember: decibels are not a linear scale. Instead, we experience an increase of 10 decibels as a doubling of loudness. For example, 80 decibels is four times louder than 60 decibels.</p>
      {/* <p>You can zoom in to get more detail about a particular city, and you can click on the buttons below to jump to different cities.</p> */}
      <p><span style={{ fontWeight: 'bold' }}>Data sources</span>: <a href="https://carto.bruitparif.fr/" target="_blank" rel="noopener noreferrer">Bruitparif</a>. Data is taken from monitoring stations on the <a href="https://rumeur.bruitparif.fr/main" target="_blank" rel="noopener noreferrer">Rumeur network</a> and intermediate points are modelled and validated against the collected data, including the effects of average weather conditions on noise levels.  <a href="https://www.bruitparif.fr/pages/En-tete/700%20Accompagner/800%20CSB%20en%20IdF/680%20Une%20m%C3%A9thodologie%20rigoureuse/2018-08-21%20-%20M%C3%A9thologie%20d'%C3%A9laboration%20des%20cartes%20strat%C3%A9giques%20de%20bruit%20de%203%C3%A8me%20%C3%A9ch%C3%A9ance%20(2017)%20en%20%C3%8Ele-de-France.pdf" target="_blank" rel="noopener noreferrer">Methodological information (in French).</a></p>
      <p>Data are under the third five year cycle of EU Environmental Noise Directive reporting. Data is ‘Lden’ (24 hour - day, evening and night) average noise levels for road traffic noise only (hence low levels can be seen on the maps close to railway stations and airports).</p>
    </div>,
  },
  london: {
    longitude: -0.048,
    latitude: 51.491,
    zoom: 10,
    bbox: [[-0.5945770815, 51.2468407724], [0.3375120088, 51.7292587128]],
    sourcesEn: <div>
      <p>Remember: decibels are not a linear scale. Instead, we experience an increase of 10 decibels as a doubling of loudness. For example, 80 decibels is four times louder than 60 decibels.</p>
      <p><span style={{ fontWeight: 'bold' }}>Data Sources</span>: <a href="https://environment.data.gov.uk/dataset/fd1c6327-ad77-42ae-a761-7c6a0866523d" target="_blank" rel="noopener noreferrer">DEFRA (Department for Environment, Transport and Rural Affairs)</a>. Data is entirely modelled and not directly from any monitoring stations. The London data only shows main roads as the UK only carries out the minimum mapping required under the EU Environmental Noise Directive.
        <a href="https://www.gov.uk/government/publications/strategic-noise-mapping-2019" target="_blank" rel="noopener noreferrer"> More information.</a></p>
      <p>Data are under the third five year cycle of EU Environmental Noise Directive reporting. Data is ‘Lden’ (24 hour - day, evening and night) average noise levels for road traffic noise only (hence low levels can be seen on the maps close to railway stations and airports).</p>
    </div>,
    sourcesFr: <div>
      <p>Il est à noter que les décibels ne suivent pas une échelle linéaire. Une augmentation de 10 décibels est ressenti comme un doublement du volume. Par exemple, 80 décibels est quatre fois plus fort que 60 décibels.</p>
      <p><span style={{ fontWeight: 'bold' }}>Sources des données</span>: <a href="https://environment.data.gov.uk/dataset/fd1c6327-ad77-42ae-a761-7c6a0866523d" target="_blank" rel="noopener noreferrer">DEFRA (Department for Environment, Transport and Rural Affairs)</a>. Les données sont entièrement modélisées sans l'aide de collecte directe depuis des stations de monitoring. Les données sur Londres ne concernent que les routes principales, correspondant au minimum requis par la directive de l'UE sur le bruit dans l'environnement.
        <a href="https://www.gov.uk/government/publications/strategic-noise-mapping-2019" target="_blank" rel="noopener noreferrer"> Plus d'information ici.</a></p>
      <p>Il s'agit de la troisième itération (cycle de 5 années) de récolte de données imposée par la directive européenne sur le bruit dans l'environnement. Les données sont du type ‘Lden’ (24 heures 7/7, jour et soir), le niveau de bruit moyen concerne le trafic routier seulement (ce qui explique les zones de faible bruit aux alentours des gares et des aéroports).</p>
    </div>,
  },
  nyc: {
    longitude: -73.917,
    latitude: 40.710,
    zoom: 10,
    bbox: [[-74.2740753571, 40.4853136705], [-73.8192439591, 40.8276099713]],
    sourcesEn: <div>
      <p>Remember: decibels are not a linear scale. Instead, we experience an increase of 10 decibels as a doubling of loudness. For example, 80 decibels is four times louder than 60 decibels.</p>
      <p><span style={{ fontWeight: 'bold' }}>Data Sources</span>: <a href="https://maps.dot.gov/BTS/NationalTransportationNoiseMap/" target="_blank" rel="noopener noreferrer">US DOT National Transportation Noise map</a>. The New York map includes both road traffic and aircraft noise, and assumes road traffic is evenly distributed through the day. <a href="https://www.bts.gov/sites/bts.dot.gov/files/docs/explore-topics-and-geography/geography/203606/btsnoisemappingtooldocumentationmarch2016.pdf" target="_blank" rel="noopener noreferrer">Methodological information</a></p>
    </div>,
    sourcesFr: <div>
      <p>Il est à noter que les décibels ne suivent pas une échelle linéaire. Une augmentation de 10 décibels est ressenti comme un doublement du volume. Par exemple, 80 décibels est quatre fois plus fort que 60 décibels.</p>
      <p><span style={{ fontWeight: 'bold' }}>Sources des données</span>: <a href="https://maps.dot.gov/BTS/NationalTransportationNoiseMap/" target="_blank" rel="noopener noreferrer">US DOT National Transportation Noise map</a>. La carte de New York, à la différence des autres villes, inclus à la fois le traffic aérien et routier, elle assume également que le traffic est uniformément distribué au cours de la journée. <a href="https://www.bts.gov/sites/bts.dot.gov/files/docs/explore-topics-and-geography/geography/203606/btsnoisemappingtooldocumentationmarch2016.pdf" target="_blank" rel="noopener noreferrer">Information sur la méthodologie.</a></p>
    </div>
  },
  bxl: {
    longitude: 4.3549,
    latitude: 50.8403,
    zoom: 11.5,
    bbox: [[4.2413799586, 50.7615138085], [4.4939662716, 50.9161092408]],
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
  const userLang = navigator.language || navigator.userLanguage;
  const languageCode = userLang && userLang.startsWith('fr') ? 'fr' : 'en';
  const [language, setLanguage] = useState(url.get('language') && ['fr', 'en'].includes(url.get('language')) ? url.get('language') : languageCode)
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);

  useEffect(() => {
    if (city && locations[city]) {
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
      navigate(`/?city=${city}&language=${language}`, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [city, language]);

  const onViewStateChange = ({ viewState }) => {
    viewState.longitude = Math.min(locations[city].bbox[1][0], Math.max(locations[city].bbox[0][0], viewState.longitude));
    viewState.latitude = Math.min(locations[city].bbox[1][1], Math.max(locations[city].bbox[0][1], viewState.latitude));
    viewState.zoom = Math.max(locations[city].zoom, viewState.zoom)
    return viewState;
  }

  const playNoise = () => {
    const audio = document.getElementById("noise-audio");
    audio.play();
  }

  const onMouseMove = (e) => {
    //https://stackoverflow.com/questions/57862383/how-to-get-the-color-of-pixels-on-mapbox
    if (mapRef) {
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
    if (!coordinates) return null;
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
        <Col span={width < 900 ? 24 : 6} style={{ padding: 16, height: width < 900 ? '' : '100vh', overflowY: width < 900 ? '' : 'scroll' }}>
          <Row justify="end" style={{ marginBottom: -35 }}>
            <Button type="link" onClick={() => setLanguage('en')}><span style={{ marginRight: -12, textDecoration: language === 'en' ? 'underline' : 'none', color: language !== 'en' ? 'grey' : '' }}>EN</span></Button>
            <Button type="link" onClick={() => setLanguage('fr')}><span style={{ textDecoration: language === 'fr' ? 'underline' : 'none', color: language !== 'fr' ? 'grey' : '' }}>FR</span></Button>
          </Row>
          <Panel setCity={setCity} city={city} language={language}
            part={width < 900 ? 1 : null}
            intro1={language === 'fr' ? intro1Fr : intro1En}
            intro2={language === 'fr' ? intro2Fr : intro2En}
            sources={language === 'fr' ? locations[city].sourcesFr : locations[city].sourcesEn}
            outro={language === 'fr' ? outroFr : outroEn} />
        </Col>
        <Col span={width < 900 ? 24 : 18} style={{ height: width < 900 ? '90vh' : '100vh' }}>
          <DeckGL
            controller={true}
            layers={layers}
            initialViewState={viewState}
            onHover={onMouseMove}
            getCursor={() => "crosshair"}
            ContextProvider={MapContext.Provider}
            onDragStart={() => setTooltip({ ...tooltip, x: -1000, y: -1000 })}
            onViewStateChange={onViewStateChange}
          >
            <ReactMapGL
              reuseMaps
              mapboxApiAccessToken={MAPBOX_ACCESS_TOKEN}
              preventStyleDiffing
              mapStyle={MAPBOX_STYLE}
              ref={map => { mapRef = map }}
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
              <Legend muted={muted} setMuted={setMuted} value={tooltip && tooltip.value} language={language} />
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
        {width < 900 && <Col span={24} style={{ padding: 16 }}>
          <Panel setCity={setCity} city={city} language={language}
            part={2}
            intro1={language === 'fr' ? intro1Fr : intro1En}
            intro2={language === 'fr' ? intro2Fr : intro2En}
            sources={language === 'fr' ? locations[city].sourcesFr : locations[city].sourcesEn}
            outro={language === 'fr' ? outroFr : outroEn} />
        </Col>
        }
      </Row>
      <Drawer
        title="Volume On"
        placement="bottom"
        closable={false}
        visible={openDrawer}
        height={350}
      >
        <p>This data visualization is an experiment aiming at making you feel and hear the noise pollution in various cities.</p>
        <p>If you want to experience the sound just crank your volume up and click on the "With sound" button.</p>
        <Row type="flex" gutter={8} justify="end" style={{ marginBottom: 24 }}>
          <Button type="default" onClick={() => { setOpenDrawer(false); }}>Without sound</Button>
          <Button style={{ marginLeft: 8 }} type="primary" onClick={() => { setOpenDrawer(false); setMuted(false); playNoise(); }}>With sound</Button>
        </Row>
      </Drawer>
    </div>
  );
}

export default App;
