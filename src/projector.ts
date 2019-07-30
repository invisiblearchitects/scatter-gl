/* Copyright 2019 Google LLC. All Rights Reserved.

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
import { DataSet } from './data';
import { LabelRenderParams } from './render';
import { PartialStyles, Styles, makeStyles } from './styles';
import { InteractionMode } from './types';
import * as util from './util';
import { SCATTER_PLOT_CUBE_LENGTH } from './constants';

import { ScatterPlotVisualizer3DLabels } from './scatter-plot-visualizer-3d-labels';
import { ScatterPlotVisualizerSprites } from './scatter-plot-visualizer-sprites';
import { ScatterPlotVisualizerCanvasLabels } from './scatter-plot-visualizer-canvas-labels';
import { ScatterPlotVisualizerPolylines } from './scatter-plot-visualizer-polylines';

export interface ProjectorParams {
  containerElement: HTMLElement;
  onHover?: (point: number | null) => void;
  onSelect?: (points: number[]) => void;
  dataSet: DataSet;
  styles?: PartialStyles;
}

type LegendPointColorer = (index: number) => string;

/**
 * Interprets projector events and assembles the arrays and commands necessary
 * to use the ScatterPlot to render the current projected data set.
 */
export class Projector {
  private containerElement: HTMLElement;
  private dataSet: DataSet;
  private styles: Styles;

  private scatterPlot: ScatterPlot;

  private labels3DMode = false;
  private spriteImageMode = false;

  private legendPointColorer: LegendPointColorer;

  private spriteVisualizer: ScatterPlotVisualizerSprites;
  private labels3DVisualizer: ScatterPlotVisualizer3DLabels;
  private canvasLabelsVisualizer: ScatterPlotVisualizerCanvasLabels;
  private polylineVisualizer: ScatterPlotVisualizerPolylines;

  private hoverPointIndex: number;
  private selectedPointIndices: number[];

  constructor(params: ProjectorParams) {
    const { containerElement, dataSet, styles = {} } = params;
    this.containerElement = containerElement;
    this.styles = makeStyles(styles);
    this.scatterPlot = new ScatterPlot(params, this.styles);
    this.createVisualizers();
    this.updateDataSet(dataSet);
  }

  set3DLabelMode(labels3DMode: boolean) {
    this.labels3DMode = labels3DMode;
    this.createVisualizers();
    this.updateScatterPlotAttributes();
    this.scatterPlot.render();
  }

  setPanMode() {
    this.scatterPlot.setInteractionMode(InteractionMode.PAN);
  }

  setSelectMode() {
    this.scatterPlot.setInteractionMode(InteractionMode.SELECT);
  }

  setLegendPointColorer(legendPointColorer: LegendPointColorer) {
    this.legendPointColorer = legendPointColorer;
  }

  resize() {
    this.scatterPlot.resize();
  }

  render() {
    this.scatterPlot.render();
  }

  updateDataSet(dataSet: DataSet, canBeRendered = true) {
    if (dataSet == null) {
      this.createVisualizers();
      this.scatterPlot.render();
      return;
    }
    this.setDataSet(dataSet);
    this.scatterPlot.setDimensions(dataSet.components);
    if (canBeRendered) {
      this.updateScatterPlotAttributes();
      this.updateScatterPlotPositions();
      this.scatterPlot.render();
    }
    this.scatterPlot.setCameraParametersForNextCameraCreation(null, false);
  }

  private setDataSet(dataSet: DataSet) {
    this.dataSet = dataSet;
    if (this.polylineVisualizer != null) {
      this.polylineVisualizer.setDataSet(dataSet);
    }
    if (this.labels3DVisualizer != null) {
      this.labels3DVisualizer.setLabelStrings(this.generate3DLabelsArray());
    }
    if (this.spriteVisualizer == null) {
      return;
    }
    this.spriteVisualizer.clearSpriteSheet();

    if (dataSet == null || dataSet.spriteMetadata == null) {
      return;
    }
    const { spriteMetadata } = dataSet;
    if (
      spriteMetadata.spriteImage == null ||
      spriteMetadata.singleSpriteSize == null
    ) {
      return;
    }
    this.spriteImageMode = true;
    const n = dataSet.points.length;
    const spriteIndices = new Float32Array(n);
    for (let i = 0; i < n; ++i) {
      spriteIndices[i] = dataSet.points[i].index;
    }

    const onImageLoad = () => this.render();
    this.spriteVisualizer.setSpriteSheet(
      spriteMetadata.spriteImage as HTMLImageElement,
      spriteMetadata.singleSpriteSize,
      spriteIndices,
      onImageLoad
    );
  }

  private updateScatterPlotPositions() {
    const newPositions = this.generatePointPositionArray();
    this.scatterPlot.setPointPositions(newPositions);
  }

  private updateScatterPlotAttributes() {
    if (this.dataSet == null) {
      return;
    }
    const selectedSet = this.selectedPointIndices;
    const hoverIndex = this.hoverPointIndex;

    const pointColorer = this.legendPointColorer;

    const pointColors = this.generatePointColorArray(
      pointColorer,
      selectedSet,
      hoverIndex,
      this.labels3DMode,
      this.spriteImageMode
    );
    const pointScaleFactors = this.generatePointScaleFactorArray(
      selectedSet,
      hoverIndex
    );
    const labels = this.generateVisibleLabelRenderParams(
      selectedSet,
      hoverIndex
    );
    const polylineColors = this.generateLineSegmentColorMap(pointColorer);
    const polylineOpacities = this.generateLineSegmentOpacityArray(selectedSet);
    const polylineWidths = this.generateLineSegmentWidthArray(selectedSet);

    this.scatterPlot.setPointColors(pointColors);
    this.scatterPlot.setPointScaleFactors(pointScaleFactors);
    this.scatterPlot.setLabels(labels);
    this.scatterPlot.setPolylineColors(polylineColors);
    this.scatterPlot.setPolylineOpacities(polylineOpacities);
    this.scatterPlot.setPolylineWidths(polylineWidths);
  }

  private generatePointPositionArray(): Float32Array {
    const { dataSet } = this;
    if (dataSet == null) return new Float32Array([]);

    let xExtent = [0, 0];
    let yExtent = [0, 0];
    let zExtent = [0, 0];

    // Determine max and min of each axis of our data.
    xExtent = util.extent(dataSet.points.map(p => p.vector[0]));
    yExtent = util.extent(dataSet.points.map(p => p.vector[1]));

    const range = [-SCATTER_PLOT_CUBE_LENGTH / 2, SCATTER_PLOT_CUBE_LENGTH / 2];

    if (dataSet.components === 3) {
      zExtent = util.extent(dataSet.points.map(p => p.vector[0]));
    }

    const positions = new Float32Array(dataSet.points.length * 3);
    let dst = 0;

    dataSet.points.forEach((d, i) => {
      const vector = dataSet.points[i].vector;

      positions[dst++] = util.scaleLinear(vector[0], xExtent, range);
      positions[dst++] = util.scaleLinear(vector[1], yExtent, range);

      if (dataSet.components === 3) {
        positions[dst++] = util.scaleLinear(vector[2], zExtent, range);
      } else {
        positions[dst++] = 0.0;
      }
    });
    return positions;
  }

  private generateVisibleLabelRenderParams(
    selectedPointIndices: number[],
    hoverPointIndex: number
  ): LabelRenderParams {
    const { styles } = this;
    const selectedPointCount =
      selectedPointIndices == null ? 0 : selectedPointIndices.length;
    const n = selectedPointCount + (hoverPointIndex != null ? 1 : 0);

    const visibleLabels = new Uint32Array(n);
    const scale = new Float32Array(n);
    const opacityFlags = new Int8Array(n);
    const fillColors = new Uint8Array(n * 3);
    const strokeColors = new Uint8Array(n * 3);
    const labelStrings: string[] = [];

    scale.fill(styles.label.scaleDefault);
    opacityFlags.fill(1);

    let dst = 0;

    if (hoverPointIndex != null) {
      labelStrings.push(this.getLabelText(hoverPointIndex));
      visibleLabels[dst] = hoverPointIndex;
      scale[dst] = styles.label.scaleLarge;
      opacityFlags[dst] = 0;
      const fillRgb = util.styleRgbFromHexColor(styles.label.fillColorHover);
      util.packRgbIntoUint8Array(
        fillColors,
        dst,
        fillRgb[0],
        fillRgb[1],
        fillRgb[2]
      );
      const strokeRgb = util.styleRgbFromHexColor(
        styles.label.strokeColorHover
      );
      util.packRgbIntoUint8Array(
        strokeColors,
        dst,
        strokeRgb[0],
        strokeRgb[1],
        strokeRgb[1]
      );
      ++dst;
    }

    // Selected points
    {
      const n = selectedPointCount;
      const fillRgb = util.styleRgbFromHexColor(styles.label.fillColorSelected);
      const strokeRgb = util.styleRgbFromHexColor(
        styles.label.strokeColorSelected
      );
      for (let i = 0; i < n; ++i) {
        const labelIndex = selectedPointIndices[i];
        labelStrings.push(this.getLabelText(labelIndex));
        visibleLabels[dst] = labelIndex;
        scale[dst] = styles.label.scaleLarge;
        opacityFlags[dst] = n === 1 ? 0 : 1;
        util.packRgbIntoUint8Array(
          fillColors,
          dst,
          fillRgb[0],
          fillRgb[1],
          fillRgb[2]
        );
        util.packRgbIntoUint8Array(
          strokeColors,
          dst,
          strokeRgb[0],
          strokeRgb[1],
          strokeRgb[2]
        );
        ++dst;
      }
    }

    return new LabelRenderParams(
      new Float32Array(visibleLabels),
      labelStrings,
      scale,
      opacityFlags,
      styles.label.fontSize,
      fillColors,
      strokeColors
    );
  }

  private generatePointScaleFactorArray(
    selectedPointIndices: number[],
    hoverPointIndex: number
  ): Float32Array {
    const { scaleDefault, scaleSelected, scaleHover } = this.styles.point;
    const dataSet = this.dataSet;
    if (dataSet == null) {
      return new Float32Array(0);
    }

    const scale = new Float32Array(dataSet.points.length);
    scale.fill(scaleDefault);

    const selectedPointCount =
      selectedPointIndices == null ? 0 : selectedPointIndices.length;

    // Scale up all selected points.
    {
      const n = selectedPointCount;
      for (let i = 0; i < n; ++i) {
        const p = selectedPointIndices[i];
        scale[p] = scaleSelected;
      }
    }

    // Scale up the hover point.
    if (hoverPointIndex != null) {
      scale[hoverPointIndex] = scaleHover;
    }

    return scale;
  }

  private generatePointColorArray(
    legendPointColorer: LegendPointColorer,
    selectedPointIndices: number[],
    hoverPointIndex: number,
    label3dMode = false,
    spriteImageMode = false
  ): Float32Array {
    const dataSet = this.dataSet;
    if (dataSet == null) {
      return new Float32Array(0);
    }

    const {
      colorHover,
      colorNoSelection,
      colorSelected,
      colorUnselected,
    } = this.styles.point;
    const selectedPointCount =
      selectedPointIndices == null ? 0 : selectedPointIndices.length;

    const colors = new Float32Array(dataSet.points.length * 3);

    let unselectedColor = colorUnselected;
    let noSelectionColor = colorNoSelection;

    if (label3dMode) {
      unselectedColor = this.styles.label3D.colorUnselected;
      noSelectionColor = this.styles.label3D.colorNoSelection;
    }

    if (spriteImageMode) {
      unselectedColor = this.styles.sprites.colorUnselected;
      noSelectionColor = this.styles.sprites.colorNoSelection;
    }

    // Give all points the unselected color.
    {
      const n = dataSet.points.length;
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
            const c = new THREE.Color(legendPointColorer(i) || undefined);
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
      const c = new THREE.Color(colorSelected);
      for (let i = 0; i < n; ++i) {
        let dst = selectedPointIndices[i] * 3;
        colors[dst++] = c.r;
        colors[dst++] = c.g;
        colors[dst++] = c.b;
      }
    }

    // Color the hover point.
    if (hoverPointIndex != null) {
      const c = new THREE.Color(colorHover);
      let dst = hoverPointIndex * 3;
      colors[dst++] = c.r;
      colors[dst++] = c.g;
      colors[dst++] = c.b;
    }

    return colors;
  }

  private generate3DLabelsArray() {
    const { dataSet } = this;
    if (dataSet == null) {
      return [];
    }
    let labels: string[] = [];
    const n = dataSet.points.length;
    for (let i = 0; i < n; ++i) {
      labels.push(this.getLabelText(i));
    }
    return labels;
  }

  generateLineSegmentColorMap(
    legendPointColorer: LegendPointColorer
  ): { [polylineIndex: number]: Float32Array } {
    const { styles } = this;
    const { dataSet } = this;
    const polylineColorArrayMap: { [polylineIndex: number]: Float32Array } = {};
    if (dataSet == null) {
      return polylineColorArrayMap;
    }

    for (let i = 0; i < dataSet.sequences.length; i++) {
      let sequence = dataSet.sequences[i];
      let colors = new Float32Array(2 * (sequence.pointIndices.length - 1) * 3);
      let colorIndex = 0;

      if (legendPointColorer) {
        for (let j = 0; j < sequence.pointIndices.length - 1; j++) {
          const c1 = new THREE.Color(
            legendPointColorer(sequence.pointIndices[j])
          );
          const c2 = new THREE.Color(
            legendPointColorer(sequence.pointIndices[j + 1])
          );
          colors[colorIndex++] = c1.r;
          colors[colorIndex++] = c1.g;
          colors[colorIndex++] = c1.b;
          colors[colorIndex++] = c2.r;
          colors[colorIndex++] = c2.g;
          colors[colorIndex++] = c2.b;
        }
      } else {
        for (let j = 0; j < sequence.pointIndices.length - 1; j++) {
          const c1 = util.getDefaultPointInPolylineColor(
            j,
            sequence.pointIndices.length,
            styles.polyline.startHue,
            styles.polyline.endHue,
            styles.polyline.saturation,
            styles.polyline.lightness
          );
          const c2 = util.getDefaultPointInPolylineColor(
            j + 1,
            sequence.pointIndices.length,
            styles.polyline.startHue,
            styles.polyline.endHue,
            styles.polyline.saturation,
            styles.polyline.lightness
          );
          colors[colorIndex++] = c1.r;
          colors[colorIndex++] = c1.g;
          colors[colorIndex++] = c1.b;
          colors[colorIndex++] = c2.r;
          colors[colorIndex++] = c2.g;
          colors[colorIndex++] = c2.b;
        }
      }

      polylineColorArrayMap[i] = colors;
    }

    return polylineColorArrayMap;
  }

  generateLineSegmentOpacityArray(selectedPoints: number[]): Float32Array {
    const { dataSet, styles } = this;
    if (dataSet == null) {
      return new Float32Array(0);
    }
    const opacities = new Float32Array(dataSet.sequences.length);
    const selectedPointCount =
      selectedPoints == null ? 0 : selectedPoints.length;
    if (selectedPointCount > 0) {
      opacities.fill(styles.polyline.deselectedOpacity);
      const i = dataSet.points[selectedPoints[0]].sequenceIndex;
      if (i !== undefined) opacities[i] = styles.polyline.selectedOpacity;
    } else {
      opacities.fill(styles.polyline.defaultOpacity);
    }
    return opacities;
  }

  generateLineSegmentWidthArray(selectedPoints: number[]): Float32Array {
    const { dataSet, styles } = this;
    if (dataSet == null) {
      return new Float32Array(0);
    }
    const widths = new Float32Array(dataSet.sequences.length);
    widths.fill(styles.polyline.defaultLineWidth);
    const selectedPointCount =
      selectedPoints == null ? 0 : selectedPoints.length;
    if (selectedPointCount > 0) {
      const i = dataSet.points[selectedPoints[0]].sequenceIndex;
      if (i !== undefined) widths[i] = styles.polyline.selectedLineWidth;
    }
    return widths;
  }

  private getLabelText(i: number) {
    const { dataSet } = this;
    const metadata = dataSet.points[i].metadata;
    return metadata && metadata.label != null ? `${metadata.label}` : '';
  }

  private createVisualizers() {
    const { scatterPlot, styles } = this;
    scatterPlot.removeAllVisualizers();

    if (this.labels3DMode) {
      this.labels3DVisualizer = new ScatterPlotVisualizer3DLabels(styles);
      this.labels3DVisualizer.setLabelStrings(this.generate3DLabelsArray());

      scatterPlot.addVisualizer(this.labels3DVisualizer);
    } else {
      this.spriteVisualizer = new ScatterPlotVisualizerSprites(styles);
      scatterPlot.addVisualizer(this.spriteVisualizer);
      this.canvasLabelsVisualizer = new ScatterPlotVisualizerCanvasLabels(
        this.containerElement,
        this.styles
      );
    }
  }
}
