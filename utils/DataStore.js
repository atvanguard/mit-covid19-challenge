const moment = require('moment')
const fs = require('fs')

const parseCsv = require('./utils').parseCsv

class DataStore {
  async init() {
    await this.processData()
    // Write scores to file
    this.writeToFile()
  }

  async processData() {
    let results = await parseCsv('./data/PopDensity_Income_Counties.csv')
    results = results.filter(r => {
      return r.County && r.State
    })
    const population = {}
    results.forEach(r => {
      const county = r.County
      const state = r.State
      const pop = parseInt(r.Population.replace(',', ''), 10)
      population[county] = population[county] || 0
      population[county] += pop
      population[state] = population[state] || 0
      population[state] += pop
    })
    console.log({ population: population['Mobile'] })

    const projections = await parseCsv('./data/Hospitalization_all_locs.csv')
    const _projections = {} // state level
    const now = moment().unix()
    projections.forEach(r => {
      const date = moment(r.date).unix()
      const state = r.location
      if (date > now && date < now + 14 * 86400) {
        const patients = parseFloat(r.ICUbed_mean)
        if (patients) {
          _projections[state] = _projections[state] || { daily: [] }
          _projections[state].daily.push(patients)
        }
      }
    })
    const reducer = (accumulator, currentValue) => accumulator + currentValue;
    Object.keys(_projections).forEach(state => {
      _projections[state].totalPatiens = parseFloat(_projections[state].daily.reduce(reducer))
    })

    let countyArea = await parseCsv('./data/county_area.csv')
    const density = {}
    countyArea.forEach(c => {
      const county = c.County.slice(0, c.County.indexOf(" County"))
      density[county] = parseFloat(c.Population.replace(',', '')) / parseInt(c.Area.slice(0, c.Area.indexOf("sq")).replace(',', ''))
      if (county == 'Mobile') {
        console.log(c)
        console.log({
          pop: parseFloat(c.Population.replace(',', '')),
          area: parseInt(c.Area.slice(0, c.Area.indexOf("sq")).replace(',', '')),
          density: density[county]
        })
      }
    })
    // console.log({ density: density['Mobile'] })

    let icuBeds = await parseCsv('./data/ICU_BEDS_COUNTY.csv')
    const _icuBeds = {}
    icuBeds.forEach(i => {
      const beds = parseInt(i.ICU_BEDS)
      if (isNaN(beds)) return
      _icuBeds[i.COUNTY] = beds
    })
    console.log({ beds: _icuBeds['Mobile'] })
    this.scores = {} // county level
    results.forEach(r => {
      try {
        const county = r.County
        const state = r.State
        const infection = _projections[state].totalPatiens * population[county] / population[state]
        this.scores[county] = this.scores[county] || { state }
        this.scores[county].icu_score = parseFloat(_icuBeds[county] || 0) * _projections[state].daily.length / infection
        this.scores[county].income = parseInt(r['Median household income'].slice(1).replace(',', ''))
        this.scores[county].density = density[county] || r['Density']
        if (county == 'Mobile') console.log({ income: this.scores[county].income })
      } catch(e) {
        // console.log(e)
        // console.log(r)
      }
    })
    this.normalize()
    // console.log(this.scores, Object.keys(this.scores).length)
  }

  normalize() {
    const range = {
      icu_score: { min: 999999.9, max: -1 },
      income: { min: 999999.9, max: -1 },
      density: { min: 999999.9, max: -1 },
    }
    Object.keys(this.scores).forEach(county => {
      range.icu_score.max = Math.max(range.icu_score.max, this.scores[county].icu_score)
      range.icu_score.min = Math.min(range.icu_score.min, this.scores[county].icu_score)

      range.income.max = Math.max(range.income.max, this.scores[county].income)
      range.income.min = Math.min(range.income.min, this.scores[county].income)

      range.density.max = Math.max(range.density.max, this.scores[county].density)
      range.density.min = Math.min(range.density.min, this.scores[county].density)
    })
    Object.keys(this.scores).forEach(county => {
      this.scores[county].icu_score = (this.scores[county].icu_score - range.icu_score.min) / (range.icu_score.max - range.icu_score.min)
      this.scores[county].income_score = (this.scores[county].income - range.income.min) / (range.income.max - range.income.min)
      // because higher the density, lower the score
      this.scores[county].population_score = 1 - ((this.scores[county].density - range.density.min) / (range.density.max - range.density.min))
      // Want to reflect high vulnerability for highly vulnerable areas
      this.scores[county].vulnerability = 1 - ((this.scores[county].icu_score + this.scores[county].income_score + this.scores[county].population_score) / 3)
    })
  }

  getAllStateData() {
    return this.scores
  }

  writeToFile() {
    const data = { Alabama: [], Michigan: [], Tennessee: [] }
    Object.keys(this.scores).forEach(county => {
      const c = this.scores[county]
      if (!Object.keys(data).includes(c.state)) return
      data[c.state].push(county)
    })

    let w = 'County,State,icu_score,income_score,population_score,vulnerability\n'
    Object.keys(data).forEach(state => {
      data[state] = data[state].sort((a, b) => {
        if (this.scores[a].vulnerability > this.scores[b].vulnerability) return -1
        return 1
      }).slice(0, 3).forEach(county => {
        const c = this.scores[county]
        w += `${county},${c.state},${c.icu_score},${c.income_score},${c.population_score},${c.vulnerability}\n`
      })
    })
    console.log(w)
    fs.writeFileSync('./data/generated_scores.csv', w)
  }
}

module.exports = new DataStore()
