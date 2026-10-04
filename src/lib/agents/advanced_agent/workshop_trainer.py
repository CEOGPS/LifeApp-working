"""Workshop trainer used by the Erebus autonomy loop."""
from .tools.workshop_integration import train


def next_drill(topic: str = "lifeos operations") -> str:
    return train(topic)
