'use strict'

const IPFS = require('ipfs')
const OrbitDB = require('../../src/OrbitDB')

const elm = document.getElementById("output")
const dbnameField = document.getElementById("dbname")
const openButton = document.getElementById("open")

localStorage.debug = ''

const openDatabase = () => {
  openButton.disabled = true
  elm.innerHTML = "Starting IPFS..."

  const dbname = dbnameField.value
  const username = new Date().getTime().toString()
  const key = 'greeting'

  const ipfs = new IPFS({
    repo: '/orbitdb/examples/browser/ipfs' + username + '/ipfs',
    // init: true,
    EXPERIMENTAL: { // enable experimental features
      pubsub: true,
      sharding: false,
      dht: false,
    },
    config: {
      Bootstrap: []
    },
  })

  function handleError(e) {
    console.error(e.stack)
    elm.innerHTML = e.message  
  }

  ipfs.on('error', (e) => handleError(e))

  ipfs.on('ready', () => {
    elm.innerHTML = "Loading database..."

    const orbit = new OrbitDB(ipfs, username)

    const db = orbit.kvstore(dbname, { maxHistory: 5, syncHistory: false, path: '/orbitdb/examples/browser/keyvalue' })
    const log = orbit.eventlog(dbname + ".log", { maxHistory: 5, syncHistory: false, path: '/orbitdb/examples/browser/events' })
    const counter = orbit.counter(dbname + ".count", { maxHistory: 5, syncHistory: false, path: '/orbitdb/examples/browser/counter' })

    const creatures = ['👻', '🐙', '🐷', '🐬', '🐞', '🐈', '🙉', '🐸', '🐓']
    const idx = Math.floor(Math.random() * creatures.length)
    const creature = creatures[idx]

    const interval = Math.floor((Math.random() * 5000) + 3000)

    let count = 0
    const query = () => {
      const value = "GrEEtinGs from " + username + " " + creature + ": Hello #" + count + " (" + new Date().getTime() + ")"
      // Set a key-value pair
      count ++
      db.put(key, value)
        .then(() => counter.inc()) // Increase the counter by one
        .then(() => log.add(value)) // Add an event to 'latest visitors' log
        .then(() => getData())
        .catch((e) => handleError(e))
    }

    const getData = () => {
      const result = db.get(key)
      const latest = log.iterator({ limit: 5 }).collect()
      const count  = counter.value
      let swarmPeers = []

      ipfs.swarm.peers()
        .then((swarm) => swarmPeers = swarm)
        .then(() => ipfs.pubsub.peers(db.path))
        .then((peers) => {
          console.log("peers:", peers)
          console.log("swarm peers:", swarmPeers)
          const output = `
            <b>You are:</b> ${username} ${creature}<br>
            <b>Peers (database/network):</b> ${peers.length} / ${swarmPeers.length}<br>
            <b>Database:</b> ${db.path}<br>
            <br><b>Writing to database every ${interval} milliseconds...</b><br><br>
            <b>Key-Value Store</b>
            -------------------------------------------------------
            Key | Value
            -------------------------------------------------------
            ${key} | ${result}
            -------------------------------------------------------

            <b>Eventlog</b>
            -------------------------------------------------------
            Latest Updates
            -------------------------------------------------------
            ${latest.reverse().map((e) => e.payload.value).join('\n')}

            <b>Counter</b>
            -------------------------------------------------------
            Visitor Count: ${count}
            -------------------------------------------------------
            `
          elm.innerHTML = output.split("\n").join("<br>")
          console.log(db.path)
        })
    }

    db.events.on('synced', () => getData())
    counter.events.on('synced', () => getData())
    log.events.on('synced', () => getData())

    db.events.on('ready', () => getData())
    counter.events.on('ready', () => getData())
    log.events.on('ready', () => getData())

    // Start query loop when the databse has loaded its history
    db.load(10)
      .then(() => counter.load(10))
      .then(() => log.load(10))
      .then(() => {
        count = counter.value
        setInterval(query, interval)
      })
  })
}

openButton.addEventListener('click', openDatabase)
