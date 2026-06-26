import React from 'react';

interface InfoCardProps {
    infoVisible: boolean;
    setInfoVisible: (visible: boolean) => void;
}

const InfoCard = (props: InfoCardProps) => {
    const { infoVisible, setInfoVisible } = props;
    return (
        <div className={`info-card ${!infoVisible ? 'invisible' : ''}`} onClick={(e) => {
            e.stopPropagation();
            setInfoVisible(false);
        }}>
            <p>
                Press PLAY button to begin. Play drum pads to add notes.
                Double click on grid to add or delete notes.
                Click X on left of grid to clear notes.
            </p>
            <p>
                TRNS to transmit your loop, adding it to the swaarm.  It will last eight loops in the swarm, then fade out.
                TRNS again to update.  Activate REPT to upload continuously.
            </p>
            <p>
                Toggle off REC to play drum pads without recording.
                Toggle on OVR to delete old pattern while you play new one (use with REPT for full live engagement).
            </p>
        </div>
    )
}

export default InfoCard;