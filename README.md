# MedIRIS
**MedIRIS** (**Med**ical **I**maging **R**enderer with **I**nteractivity and **S**tylization) is a web-based 3D application for viewing PET/CT scan imagery. The target userbase is patients with cancer who have undergone a PET/CT scan as part of their treatment.

## Framework
**MedIRIS** is written in JavaScript and uses the following libraries:
- [nodemon](https://www.npmjs.com/package/nodemon)
- [twgl.js](https://github.com/greggman/twgl.js/)
- [dicomParser](https://github.com/cornerstonejs/dicomParser)
- [Tweakpane](https://github.com/cocopon/tweakpane)

## Build
To build the project, clone its repository into a folder on your machine and install Node packages in the main directory:
- `git clone https://github.com/marty-st/mediris.git`
- `npm install --save-dev nodemon`
- `npm install twgl.js`
- `npm install dicom-parser` 
- `npm install --save tweakpane`

and add the following to the `package.json` file:
```
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  }
}
```
Then run the application from the command line:
- `npm run dev`

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