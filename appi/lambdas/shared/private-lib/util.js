exports.filterByYear = (rows, year) => {
    if (rows === null) {
        return [];
    }
    return rows.filter(x => x.year >= year);
}

const findByYear = exports.findByYear = (rows, year) => {
    if (rows === null) {
        return null;
    }
    return rows.find(x => x.year === year) || null;
}


const getMaxYear = exports.getMaxYear = (res) => {
    const arr = res.data;
    if (arr.length === 0) {
        return null;
    }
    let max = arr[0].year;

    for (let i = 1, len = arr.length; i < len; i++) {
        let v = arr[i].year;
        max = (v > max) ? v : max;
    }
    return max;
}

exports.getMaxYearRecord = (res) => {
    const recordWithMaxYear = getMaxYear(res);
    if (getMaxYear) {
        return findByYear(res.data, recordWithMaxYear);
    }
    return null;
}