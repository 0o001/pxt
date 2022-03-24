import * as React from "react";
import { ControlProps, bindGestureEvents, GestureTarget, ClientCoordinates, screenToSVGCoord, clientCoord, classList } from "../util";

export interface DraggableGraphProps extends ControlProps {
    interpolation: pxt.assets.SoundInterpolation;
    min: number;
    max: number;

    aspectRatio: number; // width / height
    onPointChange: (index: number, newValue: number) => void;

    // Points are equally spaced along the graph
    points: number[];
}

export const DraggableGraph = (props: DraggableGraphProps) => {
    const {
        interpolation,
        min,
        max,
        points,
        onPointChange,
        id,
        className,
        ariaLabel,
        ariaHidden,
        ariaDescribedBy,
        role,
        aspectRatio
    } = props;

    const width = 1000;
    const height = (1 / aspectRatio) * width;

    const unit = width / 40;
    const halfUnit = unit / 2;

    const yOffset = unit * 2;
    const availableHeight = height - yOffset * 2;
    const availableWidth = width - halfUnit * 3;

    const xSlice = availableWidth / (points.length - 1);
    const yScale = availableHeight / (max - min);

    const [dragIndex, setDragIndex] = React.useState(-1);
    const [dragValue, setDragValue] = React.useState(-1);

    const svgCoordToValue = (point: DOMPoint) =>
        (1 - ((point.y - yOffset) / availableHeight)) * (max - min) + min;

    let animationRef: number;

    const throttledSetDragValue = (value: number) => {
        if (animationRef) cancelAnimationFrame(animationRef);
        animationRef = requestAnimationFrame(() => setDragValue(Math.max(Math.min(value, max), min)));
    }

    const handlePointChange = (index: number, newValue: number) => {
        onPointChange(index, Math.max(Math.min(newValue, max), min));
    }

    const refs: SVGRectElement[] = [];

    const getPointRefHandler = (index: number) =>
        (ref: SVGRectElement) => {
            if (!ref) return;

            refs[index] = ref;
        }

    React.useEffect(() => {
        refs.forEach((ref, index) => {
            ref.onpointerdown = ev => {
                if (dragIndex !== -1) return;
                const coord = clientCoord(ev);
                const svg = screenToSVGCoord(ref.ownerSVGElement, coord);
                setDragIndex(index);
                throttledSetDragValue(svgCoordToValue(svg));
            };

            ref.onpointermove = ev => {
                if (dragIndex !== index) return;
                const coord = clientCoord(ev);
                const svg = screenToSVGCoord(ref.ownerSVGElement, coord);
                throttledSetDragValue(svgCoordToValue(svg));
            };

            ref.onpointerleave = ev => {
                if (dragIndex !== index) return;
                setDragIndex(-1);
                const coord = clientCoord(ev);
                const svg = screenToSVGCoord(ref.ownerSVGElement, coord);
                handlePointChange(index, svgCoordToValue(svg));
            };

            ref.onpointerup = ev => {
                if (dragIndex !== index) return;
                setDragIndex(-1);
                const coord = clientCoord(ev);
                const svg = screenToSVGCoord(ref.ownerSVGElement, coord);
                handlePointChange(index, svgCoordToValue(svg));
            };
        });
    }, [dragIndex])

    const getValue = (index: number) => {
        if (index === dragIndex) return dragValue;
        return points[index];
    }

    return <div
        id={id}
        className={classList("common-draggable-graph", className)}
        aria-label={ariaLabel}
        aria-hidden={ariaHidden}
        aria-describedBy={ariaDescribedBy}
        role={role}>
        <svg viewBox={`0 0 ${width} ${height}`} xmlns="http://www.w3.org/2000/svg">
            {points.map((val, index) => {
                const isNotLast = index < points.length - 1;
                const x = Math.max(xSlice * index - halfUnit, unit);
                const y = yOffset + Math.max(yScale * (max - getValue(index)) - halfUnit, halfUnit);

                // The logarithmic interpolation is perpendicular to the x-axis at the beginning, so
                // flip the label to the other side if it would overlap path
                const shouldFlipLabel = isNotLast && interpolation === "logarithmic" && getValue(index + 1) > getValue(index);

                return <g key={index}>
                        <rect
                            className="draggable-graph-point"
                            x={x}
                            y={y}
                            width={unit}
                            height={unit}
                            />
                        {isNotLast &&
                            <path
                                className="draggable-graph-path"
                                stroke="black"
                                fill="none"
                                strokeWidth="1px"
                                d={getInterpolationPath(
                                    x + halfUnit,
                                    y + halfUnit,
                                    Math.max(xSlice * (index + 1), 0),
                                    yOffset + Math.max(yScale * (max - getValue(index + 1)) - halfUnit, halfUnit) + halfUnit,
                                    interpolation
                                )}
                            />
                        }
                        <text x={x + halfUnit} y={shouldFlipLabel ? y + unit * 2 : y - halfUnit} fontSize={unit} className="common-draggable-graph-text">
                            {Math.round(getValue(index))}
                        </text>
                        <rect
                            className="draggable-graph-surface"
                            ref={getPointRefHandler(index)}
                            x={x - xSlice / 6}
                            y={0}
                            width={xSlice / 3}
                            height={height}
                            fill="white"
                            opacity={0}
                            />
                    </g>
            })}
        </svg>
    </div>
}

function getInterpolationPath(x0: number, y0: number, x1: number, y1: number, curve: pxt.assets.SoundInterpolation) {
    const start =`M ${x0} ${y0}`;
    switch (curve) {
        case "linear":
            return `${start} L ${x1} ${y1}`;
        case "curve":
            return `${start} Q ${x0 + 0.5 * (x1 - x0)} ${y1} ${x1} ${y1}`
        case "logarithmic":
            return `${start} Q ${x0} ${y1} ${x1} ${y1}`
    }
    return "";
}
