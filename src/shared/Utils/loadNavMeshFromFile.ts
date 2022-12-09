///////////////////////////////////////////////////////////
// CAPTAIN OBVIOUS HERE: 
// this can only be used in a NODE ENVIRONMENT, do not use to import in the client as fs is not available.
/*
import { readFile } from 'fs/promises';
import wavefrontObjParser from 'wavefront-obj-parser';
import NavMesh, { PolyPoints } from 'navmesh';

export default async function loadNavMeshFromFile(fileNameNavMesh: string) {
    const fileNavMesh = await readFile(`./public/models/${fileNameNavMesh}.obj`, 'utf8')
    var jsonNavMesh = wavefrontObjParser(fileNavMesh)
    const meshPolygonPoints:PolyPoints[] = [];
    const vertexPositions = jsonNavMesh.vertexPositions
    const array = jsonNavMesh.vertexPositionIndices
    for (let index = 0; index < array.length; index += 4) {
        const aIndex = array[index];
        const bIndex = array[index + 1]
        const cIndex = array[index + 2]
        meshPolygonPoints.push([
            {
                x: vertexPositions[aIndex * 3],
                y: vertexPositions[(aIndex * 3) + 2]
            },
            {
                x: vertexPositions[bIndex * 3],
                y: vertexPositions[(bIndex * 3) + 2]
            },
            {
                x: vertexPositions[cIndex * 3],
                y: vertexPositions[(cIndex * 3) + 2]
            }            
        ])
    }
    const navMesh = new NavMesh(meshPolygonPoints);
    return navMesh
}*/

import fs from 'fs'
import path from 'path'
import { NavMeshLoader } from '../../../node_modules/yuka/build/yuka.min.js'

export default async function loadNavMeshFromFile(fileNameNavMesh: string) {
    let url = '../../../public/models/navmesh/'+fileNameNavMesh+'.glb' ;
    console.log(url);
    const data = await fs.readFileSync( path.join( __dirname, '../../../public/models/navmesh/'+fileNameNavMesh+'.glb' ) ); 
    const loader = new NavMeshLoader(); 
    return loader.parse( data.buffer, "", { mergeConvexRegions: false } ).then( ( navMesh ) => { 
        return navMesh;
    });
}