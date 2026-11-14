/**
 * STUBS AND SETUP FOR QR SOURCEPOINT CMP
 * Version 1.1
 * Must be called before the wrapperMessagingWithoutDetection script
 * DEPLOY TO: http://hybridtv.ss7.tv/common/vendor/sourcepoint/sourcepoint-setup.js
 */

"use strict";

/**
 * SOURCEPOINT ACCOUNT SETUP AND EVENT LISTENERS
 * 
 * You WILL need to change:
 * - messageDiv
 * - pmDiv
 * - qrId
 * 
 * You MAY need to change:
 * - baseEndpoint
 * - pmId
 * 
 * NOTE: These values should come from the Settings API
 */

window._sp_queue = [];
window._sp_ = {
  config: {
    accountId: parseInt(window.accountId, 10),
    propertyId: parseInt(window.propertyId, 10),
    propertyHref: "https://" + window.propertyName, 
    pmId: parseInt(window.privacyManagerId, 10), 
    baseEndpoint: window.baseEndpoint,
    messageDiv: "cmpconsentfirstlayer",
    pmDiv: "cmpconsentsecondlayer",
    qrId: "qrConsent_img",
    consentLanguage: window.consentLanguage,
    isSPA: true,
    buildMessageComponents: true, // Set to true to allow us to update elements ourselves like QR image url for second layer
    exposeGlobals: true,  // When true, helper functions will be attached globally
    qrUrl: window.qrUrl,
    pmUrl:  window.pmUrl,
    events: {
      onConsentReady: function(consentUUID, euconsent, vendorGrants, consentStatus, purposes) {
        console.log("Custom - onConsentReady");
        //console.log("consentUUID:", consentUUID);
        //console.log("euconsent:", euconsent);
        window.euconsent = euconsent;
      },
      onConsentStatusReceived: function(test) {
        console.log("consentReceived");
        console.log(test);
      },
      onMessageComposed: function() {
        console.log("onMessageComposed");
        // Add any UI post-processing here

        //updateConsentStatus to pull information user has accepted /rejected consent using QR code
      },
      onMetaDataReceived:function(metaData) {
        window.sourcepointMetadata = metaData;
        var event = new CustomEvent('CONSENT_METADATA', { detail: metaData });
        window.dispatchEvent(event);
      }
    }
  }
};
