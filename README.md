LPG Services ·
[![Build Status](https://travis-ci.org/Civil-Service-Human-Resources/lpg-services.svg?branch=master)](https://travis-ci.org/Civil-Service-Human-Resources/lpg-services)
=====================
lpg-services contains the code you need to start the Learning Platform for Government application.
## Getting Started

### Prerequisites
#### Installs
Please have the following downloaded and installed:
* [Docker](https://www.docker.com/get-docker)
* [node/npm](https://nodejs.org/en/)
* [Keybase](https://keybase.io/)
* [Prettier](https://prettier.io/)
* [TSlint](https://palantir.github.io/tslint/)

#### Set up local hosts file
Add the following to your `/etc/hosts`
```
127.0.0.1    lpg.local.cshr.digital,identity.local.cshr.digital
```
#### Keybase
Request Keybase access from [Yuksel](https://github.com/elxsy) or [Rob](https://github.com/robertmarks), and ensure the application is running and enabled in Finder (`Settings > Advanced > Enable Keybase in Finder`)

#### Docker
Log into Docker 

### Installation
Clone the application

Navigate to the root of the directory and run the back-end services using docker:  
```
docker-compose up
```

Open a new terminal tab, and run the core LPG application using npm:
```
npm install
npm run build
npm run start:all
```

There are additional npm scripts for the application which can be found in [package.json](https://github.com/Civil-Service-Human-Resources/lpg-services/blob/master/package.json).

### Accessing the app
The various interfaces of the app accessed via the following URLs:  

| INTERFACE | DESCRIPTION | URL |
|--|--|--|
| LPG UI | Main UI of the platform | http://lpg.local.cshr.digital:3001/home |
| LPG Management | Content management interface | http://lpg.local.cshr.digital:3005/content-management |
| Identity | Identity authentication service | http://localhost:8080 |
| Identity Management | User account admin for managing identity details | http://localhost:8081/management/identities |


## Technical Overview
### [Lib](src/lib)

* The templating engine we are currently using is [svelte.technology](https://svelte.technology)@v2.
  See more about how to use it in this project [here](src/lib/ui/README.md)

### Testing

#### [WebdriverIO](test/webdriver)

All the services required to run this are npm dependencies. To run against different environments locally you need to set the appropriate environment variable.

In the webdriver dir of this repo, run the following commands:  
```
npm install
npm run build
npm run test
```

#### Configure WebdriverIO capabilities

Browser type, timeouts, services and browser instances can be configured within [wdio.conf.js](test/webdriver/wdio.conf.js)

## Styling

* scss is being used for css
* use `npm run watch-sass:ui` to start watching scss files in the ui repo
* `src/[ui/management-ui]/assets/styles/main.scss` is where all styles are being imported
* govuk-frontend-toolkit and -elements are being used and imported in `src/[ui/management-ui]/assets/styles/custom`

We are using the [BEM](http://getbem.com/introduction/) (Block Element Modifier) methodology. To make the scss more readable you can use `@include e('nameofelement'){}` to do `&__(nameofelement){}`. The same with modifiers using `@include m()`.

Deciding whether something should be a block, element or modifier is sometimes tricky or confusing. Here is an example:
html:

```
<div class="human">
    <div class="human__head">
        <span class="human__eye human__eye--blue human__eye--left">
        </span>
        <span class="human__eye human__eye--blue human__eye--right">
        </span>
    </div>

</div>
```

scss:

```
.human {
    height: 180px;
    @include e('head') { //.human__head: head is an element, a part of the block
        display: block;
    }
    @include e('eye') {
    /*
     *.human__eye: eye although is an element of head, that introduces a level of nesting which is anti-BEM
     */

        /* you could still use .human__eye, and it will be blue but wont float.
        * all of the tags (div, span, etc) all need .human__eye, otherwise they will not be the right size, or display-inline.  
        */
        width: 2px;
        display: inline-block;


        @include m(blue) { //.human__eye--blue: if you want the eye to be blue
            color: blue;
        }

        @include m(left) { //.human__eye--left this is modifying the eye for left types
            float: left;
        }
        @include m(right) { //and right eye..
            float: right;
        }
    }

}
```
