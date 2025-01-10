/**
 * samples.js
 * purpose: parses soundfont samples, resamples if needed.
 * loads sample data, handles async loading of sf3 compressed samples
 */
import { SpessaSynthWarn } from "../../utils/loggin.js";

// should be reasonable for most cases
const RESAMPLE_RATE = 48000;

export class BasicSample
{
    /**
     * The basic representation of a soundfont sample
     * @param sampleName {string} The sample's name
     * @param sampleRate {number} The sample's rate in Hz
     * @param samplePitch {number} The sample's pitch as a MIDI note number
     * @param samplePitchCorrection {number} The sample's pitch correction in cents
     * @param sampleLink {number} The sample's link, currently unused
     * @param sampleType {number} The sample's type, an enum
     * @param loopStart {number} The sample's loop start relative to the sample start in sample points
     * @param loopEnd {number} The sample's loop end relative to the sample start in sample points
     */
    constructor(
        sampleName,
        sampleRate,
        samplePitch,
        samplePitchCorrection,
        sampleLink,
        sampleType,
        loopStart,
        loopEnd
    )
    {
        /**
         * Sample's name
         * @type {string}
         */
        this.sampleName = sampleName;
        /**
         * Sample rate in Hz
         * @type {number}
         */
        this.sampleRate = sampleRate;
        /**
         * Original pitch of the sample as a MIDI note number
         * @type {number}
         */
        this.samplePitch = samplePitch;
        /**
         * Pitch correction, in cents. Can be negative
         * @type {number}
         */
        this.samplePitchCorrection = samplePitchCorrection;
        /**
         * Sample link, currently unused.
         * @type {number}
         */
        this.sampleLink = sampleLink;
        /**
         * Type of the sample, an enum
         * @type {number}
         */
        this.sampleType = sampleType;
        /**
         * Relative to start of the sample in sample points
         * @type {number}
         */
        this.sampleLoopStartIndex = loopStart;
        /**
         * Relative to start of the sample in sample points
         * @type {number}
         */
        this.sampleLoopEndIndex = loopEnd;
        
        /**
         * Indicates if the sample is compressed
         * @type {boolean}
         */
        this.isCompressed = (sampleType & 0x10) > 0;
        
        /**
         * The compressed sample data if it was compressed by spessasynth
         * @type {Uint8Array}
         */
        this.compressedData = undefined;
        
        /**
         * The sample's use count
         * @type {number}
         */
        this.useCount = 0;
        
        /**
         * The sample's audio data
         * @type {Float32Array}
         */
        this.sampleData = undefined;
    }
    
    /**
     * @returns {Uint8Array|IndexedByteArray}
     */
    getRawData()
    {
        const uint8 = new Uint8Array(this.sampleData.length * 2);
        for (let i = 0; i < this.sampleData.length; i++)
        {
            const sample = Math.floor(this.sampleData[i] * 32768);
            uint8[i * 2] = sample & 0xFF; // lower byte
            uint8[i * 2 + 1] = (sample >> 8) & 0xFF; // upper byte
        }
        return uint8;
    }
    
    resampleData(newSampleRate)
    {
        let audioData = this.getAudioData();
        const ratio = newSampleRate / this.sampleRate;
        const resampled = new Float32Array(Math.floor(audioData.length * ratio));
        for (let i = 0; i < resampled.length; i++)
        {
            resampled[i] = audioData[Math.floor(i * (1 / ratio))];
        }
        audioData = resampled;
        this.sampleRate = newSampleRate;
        // adjust loop points
        this.sampleLoopStartIndex = Math.floor(this.sampleLoopStartIndex * ratio);
        this.sampleLoopEndIndex = Math.floor(this.sampleLoopEndIndex * ratio);
        this.sampleData = audioData;
    }
    
    /**
     * @param quality {number}
     * @param encodeVorbis {EncodeVorbisFunction}
     */
    compressSample(quality, encodeVorbis)
    {
        // no need to compress
        if (this.isCompressed)
        {
            return;
        }
        // compress, always mono!
        try
        {
            // if the sample rate is too low or too high, resample
            let audioData = this.getAudioData();
            if (this.sampleRate < 8000 || this.sampleRate > 96000)
            {
                this.resampleData(RESAMPLE_RATE);
                audioData = this.getAudioData();
            }
            this.compressedData = encodeVorbis([audioData], 1, this.sampleRate, quality);
            // flag as compressed
            this.sampleType |= 0x10;
            this.isCompressed = true;
        }
        catch (e)
        {
            SpessaSynthWarn(`Failed to compress ${this.sampleName}. Leaving as uncompressed!`);
            this.isCompressed = false;
            this.compressedData = undefined;
            // flag as uncompressed
            this.sampleType &= 0xEF;
        }
        
    }
    
    /**
     * @returns {Float32Array}
     */
    getAudioData()
    {
        return this.sampleData;
    }
}