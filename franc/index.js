(function (window) {
  /* Maximum sample length. */
  const MAX_LENGTH = 2048

  /* Minimum sample length. */
  const MIN_LENGTH = 10

  /* The maximum distance to add when a given trigram does
   * not exist in a trigram dictionary. */
  const MAX_DIFFERENCE = 300

  const own = {}.hasOwnProperty

  /* Construct trigram dictionaries. */
  /** @type {string} */
  let script

  /** @type {Record<string, Record<string, Record<string, number>>>} */
  const numericData = {}

  for (script in window.francData) {
    if (own.call(window.francData, script)) {
      const languages = window.francData[script]
      /** @type {string} */
      let name

      numericData[script] = {}

      for (name in languages) {
        if (own.call(languages, name)) {
          const model = languages[name].split('|')
          /** @type {Record<string, number>} */
          const trigrams = {}
          let weight = model.length

          while (weight--) {
            trigrams[model[weight]] = weight
          }

          numericData[script][name] = trigrams
        }
      }
    }
  }

  /**
   * Get the most probable language for the given value.
   *
   * @param {string} [value]
   *   The value to test.
   * @param {Object} [options]
   *   Configuration.
   * @return {string}
   *  The most probable language.
   */
  function franc(value, options) {
    return francAll(value, options)[0][0]
  }

  /**
   * Get a list of probable languages the given value is
   * written in.
   *
   * @param {string} [value]
   *   The value to test.
   * @param {Object} [options]
   *   Configuration.
   * @return {Array<Array<string|number>>}
   *   An array containing language—distance tuples.
   */
  function francAll(value, options = {}) {
    /** @type {Array<string>} */
    const only = [...(options.whitelist || []), ...(options.only || [])]
    /** @type {Array<string>} */
    const ignore = [...(options.blacklist || []), ...(options.ignore || [])]
    const minLength =
      options.minLength !== null && options.minLength !== undefined
        ? options.minLength
        : MIN_LENGTH

    if (!value || value.length < minLength) {
      return und()
    }

    value = value.slice(0, MAX_LENGTH)

    /* Get the script which characters occur the most
     * in `value`. */
    const script = getTopScript(value, window.francExpressions)

    /* One languages exists for the most-used script. */
    if (!script[0] || !(script[0] in numericData)) {
      /* If no matches occured, such as a digit only string,
       * or because the language is ignored, exit with `und`. */
      if (!script[0] || script[1] === 0 || !allow(script[0], only, ignore)) {
        return und()
      }

      return singleLanguageTuples(script[0])
    }

    /* Get all distances for a given script, and
     * normalize the distance values. */
    return normalize(
      value,
      getDistances(asTuples(value), numericData[script[0]], only, ignore)
    )
  }

  /**
   * Normalize the difference for each tuple in
   * `distances`.
   *
   * @param {string} value
   *   Value to normalize.
   * @param {Array<Array<string|number>>} distances
   *   List of distances.
   * @return {Array<Array<string|number>>}
   *   Normalized distances.
   */
  function normalize(value, distances) {
    const min = distances[0][1]
    const max = value.length * MAX_DIFFERENCE - min
    let index = -1

    while (++index < distances.length) {
      distances[index][1] = 1 - (distances[index][1] - min) / max || 0
    }

    return distances
  }

  /**
   * From `scripts`, get the most occurring expression for
   * `value`.
   *
   * @param {string} value
   *   Value to check.
   * @param {Record<string, RegExp>} scripts
   *   Top-Scripts.
   * @return {[string|undefined, number]}
   *   Top script and its occurrence percentage.
   */
  function getTopScript(value, scripts) {
    let topCount = -1
    /** @type {string|undefined} */
    let topScript
    /** @type {string} */
    let script

    for (script in scripts) {
      if (own.call(scripts, script)) {
        const count = getOccurrence(value, scripts[script])

        if (count > topCount) {
          topCount = count
          topScript = script
        }
      }
    }

    return [topScript, topCount]
  }

  /**
   * Get the occurrence ratio of `expression` for `value`.
   *
   * @param {string} value
   *   Value to check.
   * @param {RegExp} expression
   *   Code-point expression.
   * @return {number}
   *   Float between 0 and 1.
   */
  function getOccurrence(value, expression) {
    const count = value.match(expression)

    return (count ? count.length : 0) / value.length || 0
  }

  /**
   * Get the distance between an array of trigram—count
   * tuples, and multiple trigram dictionaries.
   *
   * @param {Array<Array<string|number>>} trigrams
   *   An array containing trigram—count tuples.
   * @param {Record<string, Record<string, number>>} languages
   *   Multiple trigrams to test against.
   * @param {Array<string>} only
   *   Allowed languages; if non-empty, only included languages are kept.
   * @param {Array<string>} ignore
   *   Disallowed languages; included languages are ignored.
   * @return {Array<Array<string|number>>} An array
   *   containing language—distance tuples.
   */
  function getDistances(trigrams, languages, only, ignore) {
    languages = filterLanguages(languages, only, ignore)

    /** @type {Array<Array<string|number>>} */
    const distances = []
    /** @type {string} */
    let language

    if (languages) {
      for (language in languages) {
        if (own.call(languages, language)) {
          distances.push([language, getDistance(trigrams, languages[language])])
        }
      }
    }

    return distances.length === 0 ? und() : distances.sort(sort)
  }

  /**
   * Get the distance between an array of trigram—count
   * tuples, and a language dictionary.
   *
   * @param {Array<Array<string|number>>} trigrams
   *   An array containing trigram—count tuples.
   * @param {Record<string, number>} model
   *   Object containing weighted trigrams.
   * @return {number}
   *   The distance between the two.
   */
  function getDistance(trigrams, model) {
    let distance = 0
    let index = -1

    while (++index < trigrams.length) {
      const trigram = trigrams[index]
      let difference = MAX_DIFFERENCE

      if (trigram[0] in model) {
        difference = trigram[1] - model[trigram[0]] - 1

        if (difference < 0) {
          difference = -difference
        }
      }

      distance += difference
    }

    return distance
  }

  /**
   * Filter `languages` by removing languages in
   * `ignore`, or including languages in `only`.
   *
   * @param {Record<string, Record<string, number>>} languages
   *   Languages to filter
   * @param {Array<string>} only
   *   Allowed languages; if non-empty, only included languages are kept.
   * @param {Array<string>} ignore
   *   Disallowed languages; included languages are ignored.
   * @return {Record<string, Record<string, number>>}
   *   Filtered array of languages.
   */
  function filterLanguages(languages, only, ignore) {
    if (only.length === 0 && ignore.length === 0) {
      return languages
    }

    /** @type {Record<string, Record<string, number>>} */
    const filteredLanguages = {}
    /** @type {string} */
    let language

    for (language in languages) {
      if (allow(language, only, ignore)) {
        filteredLanguages[language] = languages[language]
      }
    }

    return filteredLanguages
  }

  /**
   * Check if `language` can match according to settings.
   *
   * @param {string} language
   *   Languages to filter
   * @param {Array<string>} only
   *   Allowed languages; if non-empty, only included languages are kept.
   * @param {Array<string>} ignore
   *   Disallowed languages; included languages are ignored.
   * @return {boolean}
   *   Whether `language` can match
   */
  function allow(language, only, ignore) {
    if (only.length === 0 && ignore.length === 0) {
      return true
    }

    return (
      (only.length === 0 || only.includes(language)) && !ignore.includes(language)
    )
  }

  /**
   * Create a single `und` tuple.
   */
  function und() {
    return singleLanguageTuples('und')
  }

  /**
   * Create a single tuple as a list of tuples from a given language code.
   *
   * @param {string} language
   * @returns {Array<Array<string|number>>}
   */
  function singleLanguageTuples(language) {
    return [[language, 1]]
  }

  /**
   * Deep regular sort on the number at `1` in both objects.
   *
   * @param {Array<string|number>} a
   * @param {Array<string|number>} b
   */
  function sort(a, b) {
    return a[1] - b[1]
  }

  /**
   * Convert a given string to an array of trigram--count tuples.
   *
   * @param {string} value
   * @returns {Array<Array<string|number>>}
   */
  function asTuples(value) {
    const trigrams = {}
    let index = -1
    const length = value.length

    while (++index < length) {
      const trigram = value.slice(index, index + 3).toLowerCase()

      if (trigram.length === 3) {
        if (own.call(trigrams, trigram)) {
          trigrams[trigram]++
        } else {
          trigrams[trigram] = 1
        }
      }
    }

    return Object.keys(trigrams).map((trigram) => [trigram, trigrams[trigram]])
  }

  // Exposer les fonctions publiques
  window.franc = franc;
  window.francAll = francAll;

})(window);