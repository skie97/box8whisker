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
    q1Value: PrimitiveValue;
    q3Value: PrimitiveValue;
    category: string;
    color: string;
    strokeColor: string;
    strokeWidth: number;
    selectionId: ISelectionId;
    datapoints: number[];
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
        || !dataViews[0].table.rows) {
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
            category: "",
            color: "",
            strokeColor: "",
            strokeWidth: 2,
            selectionId: null,
            datapoints: []
        };
        datapoint.category = key;
        datapoint.datapoints = data[key];
        datapoint.maxValue = d3.max(data[key]);
        datapoint.minValue = d3.min(data[key]);
        datapoint.medianValue = d3.median(data[key]);
        datapoint.q1Value = d3.quantile(data[key], 0.25);
        datapoint.q3Value = d3.quantile(data[key], 0.75);
        datapoint.color = "grey";
        datapoint.strokeColor = "black";
        viewModel.dataPoints.push(datapoint);
        viewModel.dataMax = Math.max(viewModel.dataMax, Number(d3.max(data[key])));
    }
    console.log(viewModel);

    return viewModel;
}

export class Visual implements IVisual {
    private svg: Selection<SVGElement>;
    private table: HTMLTableElement;
    private settings: VisualSettings;
    private host: IVisualHost;

    constructor(options: VisualConstructorOptions) {
        // this.svg = d3.select(options.element).append('svg');
        this.table = document.createElement('table');
        options.element.appendChild(this.table);
        this.host = options.host;
    }

    public update(options: VisualUpdateOptions) {
        const dataView: DataView = options.dataViews[0];
        const tableDataview: DataViewTable = dataView.table;
        visualTransform(options, this.host);

        if (!tableDataview){
            return;
        }

        while (this.table.firstChild) {
            this.table.removeChild(this.table.firstChild);
        }

        // draw header
        const tableHeader = document.createElement("th");
        tableDataview.columns.forEach((column: DataViewMetadataColumn) => {
            const tableHeaderColumn = document.createElement("td");
            tableHeaderColumn.innerText = column.displayName;
            tableHeader.appendChild(tableHeaderColumn);
            this.table.appendChild(tableHeader);
        });

        // draw rows
        tableDataview.rows.forEach((row: powerbi.DataViewTableRow) => {
            const tableRow = document.createElement("tr");
            row.forEach((columnValue: powerbi.PrimitiveValue) => {
                const cell = document.createElement("td");
                cell.innerText = columnValue.toString();
                tableRow.appendChild(cell);
            })
            this.table.appendChild(tableRow);
        })
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