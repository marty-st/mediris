# MedIRIS
**MedIRIS** (**Med**ical **I**maging **R**enderer with **I**nteractivity and **S**tylization) is a web-based 3D application for viewing PET/CT scan imagery. The target userbase is patients with cancer who have undergone a PET/CT scan as part of their treatment.

## Framework
**MedIRIS** is written in JavaScript and uses the following libraries:
- [Vite](https://github.com/vitejs/vite) (dev only)
- [twgl.js](https://github.com/greggman/twgl.js/)
- [dicomParser](https://github.com/cornerstonejs/dicomParser)
- [Cornerstone WADO Image Loader](https://github.com/cornerstonejs/cornerstone3D/)
- [Cornerstone Core](https://github.com/cornerstonejs/cornerstone3D/)
- [Tweakpane](https://github.com/cocopon/tweakpane)

## Build
To build the project:
### 1. Clone its repository into a folder on your machine
```
git clone https://github.com/marty-st/mediris.git
```
### 2. install Node packages in the root of the project
(You must have [Node.js](https://nodejs.org/en) installed on your machine)
```
`npm install --save-dev vite`
`npm install twgl.js`
`npm install dicom-parser cornerstone-wado-image-loader cornerstone-core` 
`npm install --save tweakpane`
```
### 3. Add the following to the `package.json` file:
```
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "server": "node server.js"
  }
}
```
### 4. Run the application from the command line:
```
npm run dev
```

## License
MedIRIS, a web-based application for viewing PET/CT scan imagery.
Copyright (C) <2025>  Martin Štourač

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program.  If not, see https://www.gnu.org/licenses/.