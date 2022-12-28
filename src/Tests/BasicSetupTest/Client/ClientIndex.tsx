import React from 'react';
import {createRoot} from 'react-dom/client'
import { ClientWebSucket } from '../../../Client/ClientImports';
import { TestRoot } from './ClientImports';


let divv = document.getElementById('reactContainer');
let root = createRoot(divv)
// root.render(<TestRoot />) 