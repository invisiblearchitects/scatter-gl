/* Copyright 2016 The TensorFlow Authors. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
==============================================================================*/

import * as THREE from 'three';
import { ScatterPlot } from './scatter-plot';
import { DataSet, Projection } from './data';
import * as util from './util';

import { ScatterPlotVisualizer3DLabels } from './scatter-plot-visualizer-3d-labels';
import { ScatterPlotVisualizerSprites } from './scatter-plot-visualizer-sprites';
import { ScatterPlotVisualizerCanvasLabels } from './scatter-plot-visualizer-canvas-labels';
import { ScatterPlotVisualizerPolylines } from './scatter-plot-visualizer-polylines';

const POINT_COLOR_UNSELECTED = 0xe3e3e3;
const POINT_COLOR_NO_SELECTION = 0x7575d9;
const POINT_COLOR_SELECTED = 0xfa6666;
const POINT_COLOR_HOVER = 0x760b4f;

const POINT_SCALE_DEFAULT = 1.0;
const POINT_SCALE_SELECTED = 1.2;
const POINT_SCALE_NEIGHBOR = 1.2;
const POINT_SCALE_HOVER = 1.2;

const LABELS_3D_COLOR_UNSELECTED = 0xffffff;
const LABELS_3D_COLOR_NO_SELECTION = 0xffffff;

const SPRITE_IMAGE_COLOR_UNSELECTED = 0xffffff;
const SPRITE_IMAGE_COLOR_NO_SELECTION = 0xffffff;

const POLYLINE_START_HUE = 60;
const POLYLINE_END_HUE = 360;
const POLYLINE_SATURATION = 1;
const POLYLINE_LIGHTNESS = 0.3;

const POLYLINE_DEFAULT_OPACITY = 0.2;
const POLYLINE_DEFAULT_LINEWIDTH = 2;
const POLYLINE_SELECTED_OPACITY = 0.9;
const POLYLINE_SELECTED_LINEWIDTH = 3;
const POLYLINE_DESELECTED_OPACITY = 0.05;

const SCATTER_PLOT_CUBE_LENGTH = 2;

/** Color scale for nearest neighbors. */
// const NN_COLOR_SCALE = d3
//   .scaleLinear<string, string>()
//   .domain([1, 0.7, 0.4])
//   .range(['hsl(285, 80%, 40%)', 'hsl(0, 80%, 65%)', 'hsl(40, 70%, 60%)'])
//   .clamp(true);
const NN_COLOR_SCALE = [];

export interface ProjectorParams {
  containerElement: HTMLElement;
  onHover?: (point: number | null) => void;
  onSelect?: (points: number[]) => void;
}

/**
 * Interprets projector events and assembles the arrays and commands necessary
 * to use the ScatterPlot to render the current projected data set.
 */
export class Projector {
  public scatterPlot: ScatterPlot;
  private projection: Projection;
  private labelPointAccessor: string;
  private containerElement: HTMLElement;

  private spriteVisualizer: ScatterPlotVisualizerSprites;
  private labels3DVisualizer: ScatterPlotVisualizer3DLabels;
  private canvasLabelsVisualizer: ScatterPlotVisualizerCanvasLabels;
  private polylineVisualizer: ScatterPlotVisualizerPolylines;

  private hoverPointIndex: number;
  private selectedPointIndices: number[];

  constructor(private params: ProjectorParams) {
    const { containerElement } = this.params;
    this.containerElement = containerElement;
    this.scatterPlot = new ScatterPlot(containerElement, this);
    // eventContext.registerProjectionChangedListener(projection => {
    //   this.projection = projection;
    //   this.updateScatterPlotWithNewProjection(projection);
    // });
    // eventContext.registerSelectionChangedListener(selectedPointIndices => {
    //   // this.selectedPointIndices = selectedPointIndices;
    //   // this.updateScatterPlotPositions();
    //   // this.updateScatterPlotAttributes();
    //   // this.scatterPlot.render();
    // });
    // eventContext.registerHoverListener(hoverPointIndex => {
    //   // this.hoverPointIndex = hoverPointIndex;
    //   // this.updateScatterPlotAttributes();
    //   // this.scatterPlot.render();
    // });
    // eventContext.registerDistanceMetricChangedListener(distanceMetric => {
    //   // this.updateScatterPlotAttributes();
    //   // this.scatterPlot.render();
    // });
    this.createVisualizers();
  }

  // TODO(andycoene): Implement methods!!!
  onSelect(selection: number[]) {
    if (this.params.onSelect) this.params.onSelect(selection);
  }

  // TODO(andycoene): Implement methods!!!
  onHover(point: number | null) {
    if (this.params.onHover) this.params.onHover(point);
  }

  notifyProjectionPositionsUpdated() {
    this.updateScatterPlotPositions();
    this.scatterPlot.render();
  }

  setProjection(projection: Projection) {
    this.projection = projection;
    if (this.polylineVisualizer != null) {
      // this.polylineVisualizer.setDataSet(dataSet);
    }
    if (this.labels3DVisualizer != null) {
      // this.labels3DVisualizer.setLabelStrings(
      //   this.generate3DLabelsArray(dataSet, this.labelPointAccessor)
      // );
    }
    if (this.spriteVisualizer == null) {
      return;
    }
    this.spriteVisualizer.clearSpriteAtlas();

    // const dataSet = projection.dataSet;
    // if ((dataSet == null) || (dataSet.spriteAndMetadataInfo == null)) {
    //   return;
    // }
    // const metadata = dataSet.spriteAndMetadataInfo;
    // if ((metadata.spriteImage == null) || (metadata.spriteMetadata == null)) {
    //   return;
    // }
    // const n = dataSet.points.length;
    // const spriteIndices = new Float32Array(n);
    // for (let i = 0; i < n; ++i) {
    //   spriteIndices[i] = dataSet.points[i].index;
    // }

    // this.spriteVisualizer.setSpriteAtlas(
    //     metadata.spriteImage, metadata.spriteMetadata.singleImageDim,
    //     spriteIndices);
  }

  // setLabelPointAccessor(labelPointAccessor: string) {
  //   this.labelPointAccessor = labelPointAccessor;
  //   if (this.labels3DVisualizer != null) {
  //     const ds = this.projection.dataSet;
  //     this.labels3DVisualizer.setLabelStrings(
  //       this.generate3DLabelsArray(ds, labelPointAccessor) || []
  //     );
  //   }
  // }

  resize() {
    this.scatterPlot.resize();
  }

  updateScatterPlotPositions() {
    const newPositions = this.generatePointPositionArray(this.projection);
    this.scatterPlot.setPointPositions(newPositions);
  }

  updateScatterPlotAttributes() {
    if (this.projection == null) {
      return;
    }
    const dataSet = this.projection.dataSet;
    const selectedSet = this.selectedPointIndices;
    const hoverIndex = this.hoverPointIndex;

    const neighbors = [];
    // const neighbors = this.neighborsOfFirstSelectedPoint;

    const pointColorer = null;
    // const pointColorer = this.legendPointColorer;

    const pointColors = this.generatePointColorArray(
      dataSet,
      pointColorer,
      selectedSet,
      neighbors,
      hoverIndex
    );
    const pointScaleFactors = this.generatePointScaleFactorArray(
      dataSet,
      selectedSet,
      neighbors,
      hoverIndex
    );
    //   const labels = this.generateVisibleLabelRenderParams(
    //     dataSet,
    //     selectedSet,
    //     neighbors,
    //     hoverIndex
    //   );
    //   const polylineColors = this.generateLineSegmentColorMap(
    //     dataSet,
    //     pointColorer
    //   );
    //   const polylineOpacities = this.generateLineSegmentOpacityArray(
    //     dataSet,
    //     selectedSet
    //   );
    //   const polylineWidths = this.generateLineSegmentWidthArray(
    //     dataSet,
    //     selectedSet
    //   );

    this.scatterPlot.setPointColors(pointColors);
    this.scatterPlot.setPointScaleFactors(pointScaleFactors);
    // this.scatterPlot.setLabels(labels);
    // this.scatterPlot.setPolylineColors(polylineColors);
    //   this.scatterPlot.setPolylineOpacities(polylineOpacities);
    //   this.scatterPlot.setPolylineWidths(polylineWidths);
  }

  render() {
    this.scatterPlot.render();
  }

  generatePointPositionArray(projection: Projection): Float32Array {
    if (projection == null) return new Float32Array([]);

    let xExtent = [0, 0];
    let yExtent = [0, 0];
    let zExtent = [0, 0];
    const dataSet = projection.dataSet;

    // Determine max and min of each axis of our data.
    xExtent = util.extent(dataSet.points.map(p => p.vector[0]));
    yExtent = util.extent(dataSet.points.map(p => p.vector[1]));

    const range = [-SCATTER_PLOT_CUBE_LENGTH / 2, SCATTER_PLOT_CUBE_LENGTH / 2];

    if (projection.components === 3) {
      zExtent = util.extent(dataSet.points.map(p => p.vector[0]));
    }

    const positions = new Float32Array(dataSet.points.length * 3);
    let dst = 0;

    dataSet.points.forEach((d, i) => {
      const vector = dataSet.points[i].vector;

      positions[dst++] = util.scaleLinear(vector[0], xExtent, range);
      positions[dst++] = util.scaleLinear(vector[1], yExtent, range);

      if (projection.components === 3) {
        positions[dst++] = util.scaleLinear(vector[2], zExtent, range);
      } else {
        positions[dst++] = 0.0;
      }
    });
    return positions;
  }

  generatePointScaleFactorArray(
    ds: DataSet,
    selectedPointIndices: number[],
    // neighborsOfFirstPoint: knn.NearestEntry[],
    neighborsOfFirstPoint: any[],
    hoverPointIndex: number
  ): Float32Array {
    if (ds == null) {
      return new Float32Array(0);
    }

    const scale = new Float32Array(ds.points.length);
    scale.fill(POINT_SCALE_DEFAULT);

    const selectedPointCount =
      selectedPointIndices == null ? 0 : selectedPointIndices.length;
    const neighborCount =
      neighborsOfFirstPoint == null ? 0 : neighborsOfFirstPoint.length;

    // Scale up all selected points.
    {
      const n = selectedPointCount;
      for (let i = 0; i < n; ++i) {
        const p = selectedPointIndices[i];
        scale[p] = POINT_SCALE_SELECTED;
      }
    }

    // Scale up the neighbor points.
    {
      const n = neighborCount;
      for (let i = 0; i < n; ++i) {
        const p = neighborsOfFirstPoint[i].index;
        scale[p] = POINT_SCALE_NEIGHBOR;
      }
    }

    // Scale up the hover point.
    if (hoverPointIndex != null) {
      scale[hoverPointIndex] = POINT_SCALE_HOVER;
    }

    return scale;
  }

  generatePointColorArray(
    ds: DataSet,
    // legendPointColorer: null (ds: DataSet, index: number) => string,
    legendPointColorer: any,
    selectedPointIndices: number[],
    // neighborsOfFirstPoint: knn.NearestEntry[],
    neighborsOfFirstPoint: any[][],
    hoverPointIndex: number,
    label3dMode = false,
    spriteImageMode = false
  ): Float32Array {
    if (ds == null) {
      return new Float32Array(0);
    }

    const selectedPointCount =
      selectedPointIndices == null ? 0 : selectedPointIndices.length;
    const neighborCount =
      neighborsOfFirstPoint == null ? 0 : neighborsOfFirstPoint.length;
    const colors = new Float32Array(ds.points.length * 3);

    let unselectedColor = POINT_COLOR_UNSELECTED;
    let noSelectionColor = POINT_COLOR_NO_SELECTION;

    if (label3dMode) {
      unselectedColor = LABELS_3D_COLOR_UNSELECTED;
      noSelectionColor = LABELS_3D_COLOR_NO_SELECTION;
    }

    if (spriteImageMode) {
      unselectedColor = SPRITE_IMAGE_COLOR_UNSELECTED;
      noSelectionColor = SPRITE_IMAGE_COLOR_NO_SELECTION;
    }

    // Give all points the unselected color.
    {
      const n = ds.points.length;
      let dst = 0;
      if (selectedPointCount > 0) {
        const c = new THREE.Color(unselectedColor);
        for (let i = 0; i < n; ++i) {
          colors[dst++] = c.r;
          colors[dst++] = c.g;
          colors[dst++] = c.b;
        }
      } else {
        if (legendPointColorer != null) {
          for (let i = 0; i < n; ++i) {
            const c = new THREE.Color(legendPointColorer(ds, i) || undefined);
            colors[dst++] = c.r;
            colors[dst++] = c.g;
            colors[dst++] = c.b;
          }
        } else {
          const c = new THREE.Color(noSelectionColor);
          for (let i = 0; i < n; ++i) {
            colors[dst++] = c.r;
            colors[dst++] = c.g;
            colors[dst++] = c.b;
          }
        }
      }
    }

    // Color the selected points.
    {
      const n = selectedPointCount;
      const c = new THREE.Color(POINT_COLOR_SELECTED);
      for (let i = 0; i < n; ++i) {
        let dst = selectedPointIndices[i] * 3;
        colors[dst++] = c.r;
        colors[dst++] = c.g;
        colors[dst++] = c.b;
      }
    }

    // Color the neighbors.
    // {
    //   const n = neighborCount;
    //   let minDist = n > 0 ? neighborsOfFirstPoint[0].dist : 0;
    //   for (let i = 0; i < n; ++i) {
    //     const c = new THREE.Color(
    //       dist2color(distFunc, neighborsOfFirstPoint[i].dist, minDist)
    //     );
    //     let dst = neighborsOfFirstPoint[i].index * 3;
    //     colors[dst++] = c.r;
    //     colors[dst++] = c.g;
    //     colors[dst++] = c.b;
    //   }
    // }

    // Color the hover point.
    if (hoverPointIndex != null) {
      const c = new THREE.Color(POINT_COLOR_HOVER);
      let dst = hoverPointIndex * 3;
      colors[dst++] = c.r;
      colors[dst++] = c.g;
      colors[dst++] = c.b;
    }

    return colors;
  }

  generate3DLabelsArray() {
    // generate3DLabelsArray(ds: DataSet, accessor: string) {
    // if (ds == null || accessor == null) {
    //   return null;
    // }
    // let labels: string[] = [];
    // const n = ds.points.length;
    // for (let i = 0; i < n; ++i) {
    //   labels.push(this.getLabelText(ds, i, accessor));
    // }
    // return labels;
    return [];
  }

  private getLabelText(ds: DataSet, i: number, accessor: string) {
    return ds.points[i].metadata[accessor].toString();
  }

  updateScatterPlotWithNewProjection(
    projection: Projection,
    canBeRendered = true
  ) {
    if (projection == null) {
      this.createVisualizers();
      this.scatterPlot.render();
      return;
    }
    this.setProjection(projection);
    this.scatterPlot.setDimensions(projection.components);
    if (canBeRendered) {
      this.updateScatterPlotAttributes();
      this.notifyProjectionPositionsUpdated();
    }
    this.scatterPlot.setCameraParametersForNextCameraCreation(null, false);
  }

  private createVisualizers(renderLabelsIn3D = false) {
    const scatterPlot = this.scatterPlot;
    scatterPlot.removeAllVisualizers();

    if (renderLabelsIn3D) {
      this.labels3DVisualizer = new ScatterPlotVisualizer3DLabels();
      this.labels3DVisualizer.setLabelStrings(
        // this.generate3DLabelsArray(ds, this.labelPointAccessor || [])
        this.generate3DLabelsArray()
      );

      scatterPlot.addVisualizer(this.labels3DVisualizer);
    } else {
      this.spriteVisualizer = new ScatterPlotVisualizerSprites();
      scatterPlot.addVisualizer(this.spriteVisualizer);
      this.canvasLabelsVisualizer = new ScatterPlotVisualizerCanvasLabels(
        this.containerElement
      );
    }
  }

  // private getSpriteImageMode(): boolean {
  //   if (this.projection == null) {
  //     return false;
  //   }
  //   const ds = this.projection.dataSet;
  //   if (ds == null || ds.spriteAndMetadataInfo == null) {
  //     return false;
  //   }
  //   return ds.spriteAndMetadataInfo.spriteImage != null;
  // }
}

// /**
//  * Normalizes the distance so it can be visually encoded with color.
//  * The normalization depends on the distance metric (cosine vs euclidean).
//  */
// export function normalizeDist(
//   distFunc: DistanceFunction,
//   d: number,
//   minDist: number
// ): number {
//   return distFunc === vector.dist ? minDist / d : 1 - d;
// }

// /** Normalizes and encodes the provided distance with color. */
// export function dist2color(
//   distFunc: DistanceFunction,
//   d: number,
//   minDist: number
// ): string {
//   return NN_COLOR_SCALE(normalizeDist(distFunc, d, minDist));
// }
