import NfcManager, {NfcTech} from "react-native-nfc-manager";
import { Platform } from 'react-native';

//APDU Commands for reading Balance of the Card
const chooseApplication = [0x90, 0x5A, 0x00, 0x00, 0x03, 0x5F, 0x84, 0x15, 0x00];
const readCurrentBalance = [0x90, 0x6C, 0x00, 0x00, 0x01, 0x01, 0x00];
const readLastTransaction = [0x90, 0xF5, 0x00, 0x00, 0x01, 0x01, 0x00];

let readMensaCardInformations,
    private_getMensaCardInformations,
    private_getTechnology,
    private_requestTechnology,
    private_sendCommandToMensaCard,
    private_isValidResponse,
    getValueFromBytes,
    _cleanUp;

/**
 * read the balance and the last Transaction from the Mensacard
 * @returns {Promise<{currentBalance: *, lastTransaction: *, readTime: Date}|{currentBalance: *, lastTransaction: string, readTime: Date}|undefined>}
 */
readMensaCardInformations = async () => {
    let answer;
    try {
        answer = await private_getMensaCardInformations();
    } catch (err) {
        console.warn(err);
    }
    await _cleanUp();
    return answer;
}

/**
 * read the balance and the last Transaction from the Mensacard
 * @returns {Promise<{currentBalance: *, lastTransaction: *, readTime: Date}|{currentBalance: *, lastTransaction: string, readTime: Date}|undefined>}
 */
private_getMensaCardInformations = async() => {

    //request Mifare Technology
    let respTech = await private_requestTechnology();
    if (!respTech) {
        return undefined;
    }

    //Don't really know why we need the tag but it doesn't work without
    let tag = await NfcManager.getTag();

    //sending APDU Command ChooseApplication for reading File containing the balance and last transaction
    let chooseAppResponse = await private_sendCommandToMensaCard(chooseApplication);

    //if the response is Valid the current Balance APDU Command will be send
    if (private_isValidResponse(chooseAppResponse)) {
        let currentBalanceResponse = await private_sendCommandToMensaCard(readCurrentBalance);

        //if the response is Valid the lastTransaction APDU command is send
        if (private_isValidResponse(currentBalanceResponse)) {
            let currentBalance = getValueFromBytes(currentBalanceResponse.slice(0, 4).reverse()).toString();
            let lastTransactionResponse = await private_sendCommandToMensaCard(readLastTransaction);

            //if the response is Valid the cardinformation is stored in a JSON Object and returned
            if (private_isValidResponse(lastTransactionResponse)) {
                let lastTransaction = getValueFromBytes(lastTransactionResponse.slice(12, 14).reverse()).toString();
                let answer = {
                    currentBalance: currentBalance,
                    lastTransaction: lastTransaction,
                    readTime: new Date(),
                };
                return answer;
                //else only the last Balance will be send back as A JSON Object
            } else {
                console.warn("LastTransactionResponse was not valid");
                let halfAnswer = {
                    currentBalance: currentBalance,
                    lastTransaction: "error",
                    error: true,
                    readTime: new Date(),
                };
                return halfAnswer;
            }
        }
    }
    //this only happens if something before failed or had a invalid answer
    console.warn("get Mensa Card Informations Failed");
    return undefined;
}

/**
 * return the Technology used to communicate with the NFC Card
 * @returns {string}
 */
private_getTechnology = () => {
    return Platform.OS === "ios" ? NfcTech.MifareIOS : NfcTech.IsoDep;
}

/**
 * function for Requesting the Permission to use the Technology
 * @returns {Promise<NfcTech|*|undefined>}
 */
private_requestTechnology = async () => {
    try {
        let resp = await NfcManager.requestTechnology(
            private_getTechnology(),
            {
                alertMessage: "cardInformation.iosPlaceCard"
            },
        );
        return resp;
    } catch (err) {
        console.warn("request NFC Technology failed");
        console.warn(err);
    }
    return undefined;
}

/**
 * send Mifare APDU command to the NFC Card
 * @param command the APDU Command
 * @returns {Promise<number[]|undefined>}
 */
private_sendCommandToMensaCard = async (command) => {
    try {
        if (Platform.OS === "ios") {
            return await NfcManager.sendMifareCommandIOS(command);
        } else {
            return await NfcManager.transceive(command);
        }
    } catch (err) {
        console.warn(err);
        return undefined;
    }
}

/**
 * checking if the response of the Card is valid
 * @param resp response of the card
 * @returns {boolean|boolean}
 */
private_isValidResponse = (resp) => {
    if (resp) {
        return (resp.length >= 2 && resp[resp.length - 2] === 145);
    }
    return false;
}

/**
 * function for converting byte array to the needed balance value
 * @param x
 * @returns {number}
 */
getValueFromBytes = (x) => {
    let val = 0;
    for (let i = 0; i < x.length; ++i) {
        val += x[i];
        if (i < x.length - 1) {
            val = val << 8;
        }
    }
    return val / 1000;
}

/**
 * function for Cleaning up the requests
 * @returns {Promise<void>}
 * @private
 */
_cleanUp = async () => {
    console.log("Clean Up");
    try {
        await NfcManager.cancelTechnologyRequest();
        await NfcManager.unregisterTagEvent();
        console.log("Success to cancelTechnologyRequest");
    } catch {
        console.warn("Clean Up failed");
    }
}

module.exports = {
    readMensaCardInformations,
    private_getMensaCardInformations,
    private_getTechnology,
    private_requestTechnology,
    private_sendCommandToMensaCard,
    private_isValidResponse,
    getValueFromBytes,
    _cleanUp
}
