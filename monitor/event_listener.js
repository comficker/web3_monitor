const CONTRACT_ADDRESS = '0x283af0b28c62c092c9727f1ee09c02ca627eb7f5';
const API_URL = "https://touch.enshunt.com"

const Web3 = require("web3")
const web3 = new Web3("https://eth-mainnet.gateway.pokt.network/v1/5f3453978e354ab992c4da79")
const fs = require("fs");
const ABI = require('./ABI_REGISTER.json');
const axios = require("axios")
const myContract = new web3.eth.Contract(ABI, CONTRACT_ADDRESS);

async function wait(milliseconds) {
    return await new Promise(resolve => setTimeout(resolve, milliseconds));
}

function chunk(arr, size = 100) {
    return arr.reduce((resultArray, item, index) => {
        const chunkIndex = Math.floor(index / size)
        if (!resultArray[chunkIndex]) {
            resultArray[chunkIndex] = []
        }
        resultArray[chunkIndex].push(item)
        return resultArray
    }, [])
}

async function getBlockTime(block) {
    const b = await web3.eth.getBlock(block).catch(e => {
        console.log("getBlockTime: ", e.message)
        return null
    });
    if (!b) {
        return await getBlockTime(block)
    }
    return b.timestamp
}

async function pushData(message) {
    const res = await axios.post(`${API_URL}/push-data`, {
        message,
        pwd: 'HOANGLAMBK57XYZ'
    }).then(() => true).catch(() => false)
    if (!res) {
        await wait(3000)
        await pushData(message)
    }
}

async function fetchEvent(fromBlock, save) {
    const current = await getBlockTime(fromBlock)
    await myContract.getPastEvents(
        'NameRegistered', {
            fromBlock: fromBlock,
            toBlock: fromBlock + 100
        })
        .then(async items => {
            const chunks = chunk(items)
            for (let i = 0; i < chunks.length; i++) {
                if (chunks[i].length) {
                    let text = ''
                    chunks[i].forEach(item => {
                        const c = new Date(current * 1000)
                        const e = new Date(item.returnValues.expires * 1000)
                        const t = new Date(c.getFullYear(), e.getMonth(), e.getDate(), e.getHours(), e.getMinutes(), e.getSeconds())
                        text = text + (t.getTime() / 1000) + '|'
                        text = text + item.blockNumber + '|'
                        text = text + item.transactionHash + '|'
                        text = text + item.transactionIndex + '|'
                        text = text + item.returnValues.name + '|'
                        text = text + item.returnValues.label + '|'
                        text = text + item.returnValues.owner + '|'
                        text = text + item.returnValues.cost + '|'
                        text = text + item.returnValues.expires
                        text = text + "\n"
                    })
                    if (save) {
                        fs.appendFile(save, text, (err) => {
                            if (err) {
                                console.log(err);
                            }
                        });
                    } else {
                        await pushData(text)
                        console.log("Finish: ", fromBlock);
                    }
                }
            }
        })
        .catch(err => {
            console.log('error', err.message)
        });
}

async function monitorBlock(saveLocation) {
    let startBlock = await axios.get(`${API_URL}/last-block`).then(res => {
        if (res.data.last_block) {
            return res.data.last_block
        }
        return 14889491
    })
    while (true) {
        console.log("Start: ", startBlock);
        await fetchEvent(startBlock, saveLocation)
        const currentBlock = +await web3.eth.getBlockNumber().catch(e => {
            console.log(e.message);
        })
        if (startBlock < currentBlock) {
            if (currentBlock - startBlock > 100) {
                startBlock = startBlock + 100
            } else {
                startBlock = currentBlock
                await wait(3000)
            }
        }
    }
}

monitorBlock(
    // `data_fixed/ens_15.txt`
).then(() => {
    console.log("Done");
})
