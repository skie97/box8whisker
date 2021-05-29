/*
*  Power BI Visual CLI
*
*  Copyright (c) Microsoft Corporation
*  All rights reserved.
*  MIT License
*
*  Permission is hereby granted, free of charge, to any person obtaining a copy
*  of this software and associated documentation files (the ""Software""), to deal
*  in the Software without restriction, including without limitation the rights
*  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
*  copies of the Software, and to permit persons to whom the Software is
*  furnished to do so, subject to the following conditions:
*
*  The above copyright notice and this permission notice shall be included in
*  all copies or substantial portions of the Software.
*
*  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
*  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
*  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
*  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
*  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
*  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
*  THE SOFTWARE.
*/
"use strict";

import "core-js/stable";
import "./../style/visual.less";
import powerbi from "powerbi-visuals-api";
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import EnumerateVisualObjectInstancesOptions = powerbi.EnumerateVisualObjectInstancesOptions;
import VisualObjectInstance = powerbi.VisualObjectInstance;
import DataView = powerbi.DataView;
import DataViewTable = powerbi.DataViewTable;
import VisualObjectInstanceEnumerationObject = powerbi.VisualObjectInstanceEnumerationObject;
import * as d3 from "d3";
import IVisualHost = powerbi.extensibility.visual.IVisualHost;
type Selection<T extends d3.BaseType> = d3.Selection<T, any, any, any>;
import DataViewMetadataColumn = powerbi.DataViewMetadataColumn;
import PrimitiveValue = powerbi.PrimitiveValue;
import ISelectionId = powerbi.visuals.ISelectionId;

import { VisualSettings } from "./settings";
import { Primitive } from "d3";


interface Box8WViewModel {
    dataPoints: Box8WDataPoint[];
    dataMax: number;
    settings: Box8WSettings;
}

interface Box8WDataPoint {
    minValue: PrimitiveValue;
    maxValue: PrimitiveValue;
    medianValue: PrimitiveValue;
    r0Value: PrimitiveValue;
    r1Value: PrimitiveValue;
    q1Value: PrimitiveValue;
    q3Value: PrimitiveValue;
    category: string;
    color: string;
    strokeColor: string;
    strokeWidth: number;
    selectionId: ISelectionId;
    datapoints: number[];
    outliers: Box8WDataPointOutlier[];
}

interface Box8WDataPointOutlier {
    value: PrimitiveValue;
    category: string;
}

interface Box8WSettings {

}

function visualTransform(options: VisualUpdateOptions, host: IVisualHost): Box8WViewModel {
    let dataViews = options.dataViews;
    let viewModel: Box8WViewModel = {
        dataPoints: [],
        dataMax: 0,
        settings: <Box8WSettings>{}
    }

    if (!dataViews
        || !dataViews[0]
        || !dataViews[0].table
        || !dataViews[0].table.columns
        || !dataViews[0].table.rows
        || dataViews[0].table.columns.length != 2) {
        return viewModel;
    }

    let data = {};

    const tableDataview: DataViewTable = dataViews[0].table;
    let catIndex = 0;
    let numIndex = 0;
    for (let i = 0; i < tableDataview.columns.length; i++) {
        if (tableDataview.columns[i].type.text == true) {
            catIndex = i;
        } else if (tableDataview.columns[i].type.numeric == true) {
            numIndex = i;
        }
    }

    tableDataview.rows.forEach((row: powerbi.DataViewTableRow) => {
        if (row[catIndex] as string in data) {
            data[row[catIndex] as string].push(row[numIndex])
        } else {
            data[row[catIndex] as string] = [row[numIndex]]
        }
    });

    for (let key in data) {

        let datapoint: Box8WDataPoint = {
            minValue: 0,
            maxValue: 0,
            medianValue: 0,
            q1Value: 0,
            q3Value: 0,
            r0Value: 0,
            r1Value: 0,

            category: "",
            color: "",
            strokeColor: "",
            strokeWidth: 1,
            selectionId: null,
            datapoints: [],
            outliers: []
        };
        datapoint.category = key;
        datapoint.datapoints = data[key];
        datapoint.maxValue = d3.max(data[key]);
        datapoint.minValue = d3.min(data[key]);
        datapoint.medianValue = d3.median(data[key]);
        datapoint.q1Value = d3.quantile(data[key], 0.25);
        datapoint.q3Value = d3.quantile(data[key], 0.75);
        datapoint.r0Value = Math.max(Number(datapoint.minValue),
            Number(datapoint.q1Value - (datapoint.q3Value - datapoint.q1Value)*1.5));
        datapoint.r1Value = Math.min(Number(datapoint.maxValue),
            Number(datapoint.q3Value + (datapoint.q3Value - datapoint.q1Value)*1.5));
        datapoint.color = "grey";
        datapoint.strokeColor = "black";
        for (let i = 0; i < datapoint.datapoints.length; i++) {
            if (datapoint.datapoints[i] < datapoint.r0Value
                || datapoint.datapoints[i] > datapoint.r1Value) {
                    datapoint.outliers.push({
                        value: datapoint.datapoints[i],
                        category: datapoint.category
                    })
            }
        }
        viewModel.dataPoints.push(datapoint);
        viewModel.dataMax = Math.max(viewModel.dataMax, Number(d3.max(data[key])));
    }
    return viewModel;
}

export class Visual implements IVisual {
    private svg: Selection<SVGElement>;
    private box8Wcontainer: Selection<SVGElement>;
    private settings: VisualSettings;
    private host: IVisualHost;
    private yAxis: Selection<SVGElement>;
    private xAxis: Selection<SVGElement>;
    private xAxis_Gridlines: Selection<SVGElement>;

    constructor(options: VisualConstructorOptions) {
        this.svg = d3.select(options.element).append('svg');
        this.host = options.host;

        // This is the main container for all d3 visuals
        this.box8Wcontainer = this.svg.append("g");

        // Adding the Axis and gridlines
        this.yAxis = this.svg
            .append('g')
            .classed('yAxis', true);
        this.xAxis = this.svg
            .append('g')
            .classed('xAxis', true);
        this.xAxis_Gridlines = this.svg
            .append('g')
            .classed('grid', true);
    }

    public update(options: VisualUpdateOptions) {
        this.settings = Visual.parseSettings(options && options.dataViews && options.dataViews[0]);
        const viewModel: Box8WViewModel = visualTransform(options, this.host);

        if (viewModel.dataPoints.length == 0) {
            this.box8Wcontainer.remove();
            this.box8Wcontainer = this.svg.append("g");
            return;
        }

        let width = options.viewport.width;
        let height = options.viewport.height;

        this.svg.attr('width', width)
            .attr('height', height);
        
        let y = d3.scaleBand()
            .domain(viewModel.dataPoints.map(d => d.category))
            .rangeRound([0, height - this.settings.xAxis.fontSize - 8])
            .padding(0.2);

        let x = d3.scaleLinear()
            .domain([0, viewModel.dataMax])
            .range([this.settings.yAxis.width, width-10]);

        // Draw the axis
        let yAxis = d3.axisLeft(y);
        let xAxis = d3.axisBottom(x);

        this.yAxis.attr('transform', 'translate(' 
            + this.settings.yAxis.width + ',0)')
            .style("font-size", this.settings.yAxis.fontSize)
            .call(yAxis);
        this.xAxis.attr('transform', 'translate(0,' 
            + (height - this.settings.xAxis.fontSize - 6) + ')')
            .style("font-size", this.settings.xAxis.fontSize)
            .call(xAxis);
        this.xAxis_Gridlines.attr('transform', 'translate(0,' 
            + (height - this.settings.xAxis.fontSize - 6) + ')')
            .call(xAxis.tickSize(-height).tickFormat((d,i) => ""));
        

        let boxes = this.box8Wcontainer
            .selectAll('.box8w')
            .data(viewModel.dataPoints);

        let boxesMerged = boxes.enter()
            .append('g').classed('box8w', true)

        // Can't chain as each needs to be access individually.
        // Should be self-explanitory 
        boxesMerged.append("rect").classed("box", true);
        boxesMerged.append("line").classed("minLine", true);
        boxesMerged.append("line").classed("min2boxLine", true);
        boxesMerged.append("line").classed("maxLine", true);
        boxesMerged.append("line").classed("max2boxLine", true);
        boxesMerged.append("line").classed("medianLine", true);

        // This merges with the boxes that were already there.
        boxesMerged = boxesMerged.merge(<any>boxes);

        boxesMerged.select('.box')
            .attr("width", d => x(<number>d.q3Value) - x(<number>d.q1Value))
            .attr("x", d => x(<number>d.q1Value))
            .attr("height", y.bandwidth())
            .attr("y", d => y(d.category))
            .style("fill-opacity", 0.8)
            .style("fill", d => d.color)
            .style("stroke", d => d.strokeColor)
            .style("stroke-width", d => d.strokeWidth);

        boxesMerged.select('.minLine')
            .attr("x1", d => x(<number>d.r0Value))
            .attr("x2", d => x(<number>d.r0Value))
            .attr("y1", d => y(d.category))
            .attr("y2", d => y(d.category) + y.bandwidth())
            .style("stroke", d => d.strokeColor)
            .style("stroke-width", d => d.strokeWidth);

        boxesMerged.select('.min2boxLine')
            .attr("x1", d => x(<number>d.r0Value))
            .attr("x2", d => x(<number>d.q1Value))
            .attr("y1", d => y(d.category) + (y.bandwidth() / 2))
            .attr("y2", d => y(d.category) + (y.bandwidth() / 2))
            .style("stroke", d => d.strokeColor)
            .style("stroke-width", d => d.strokeWidth);

        boxesMerged.select('.maxLine')
            .attr("x1", d => x(<number>d.r1Value))
            .attr("x2", d => x(<number>d.r1Value))
            .attr("y1", d => y(d.category))
            .attr("y2", d => y(d.category) + y.bandwidth())
            .style("stroke", d => d.strokeColor)
            .style("stroke-width", d => d.strokeWidth);

        boxesMerged.select('.max2boxLine')
            .attr("x1", d => x(<number>d.r1Value))
            .attr("x2", d => x(<number>d.q3Value))
            .attr("y1", d => y(d.category) + (y.bandwidth() / 2))
            .attr("y2", d => y(d.category) + (y.bandwidth() / 2))
            .style("stroke", d => d.strokeColor)
            .style("stroke-width", d => d.strokeWidth);

        boxesMerged.select('.medianLine')
            .attr("x1", d => x(<number>d.medianValue))
            .attr("x2", d => x(<number>d.medianValue))
            .attr("y1", d => y(d.category))
            .attr("y2", d => y(d.category) + y.bandwidth())
            .style("stroke", d => d.strokeColor)
            .style("stroke-width", d => d.strokeWidth);

        const outlierDots = boxesMerged
            .selectAll(".outlierDot")
            .data(d => d.outliers)
        
        let outlierDotsMerged = outlierDots
            .enter()
            .append("circle")
            .classed("outlierDot", true);
        
        outlierDotsMerged = outlierDotsMerged.merge(<any>outlierDots)

        outlierDotsMerged
            .attr("cx", e => x(<number>e.value))
            .attr("cy", e => y(e.category) + (y.bandwidth() / 2))
            .attr("r", this.settings.box8W.outlierDotSize)
            .style("fill", this.settings.box8W.outlierColor)
            .style("fill-opacity", 0.4);

        outlierDotsMerged.exit().remove();
        
        boxes.exit().remove();
    }

    private static parseSettings(dataView: DataView): VisualSettings {
        return <VisualSettings>VisualSettings.parse(dataView);
    }

    /**
     * This function gets called for each of the objects defined in the capabilities files and allows you to select which of the
     * objects and properties you want to expose to the users in the property pane.
     *
     */
    public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstance[] | VisualObjectInstanceEnumerationObject {
        return VisualSettings.enumerateObjectInstances(this.settings || VisualSettings.getDefault(), options);
    }
}