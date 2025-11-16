from sqlalchemy import create_engine, Column, String, Integer, Float, TIMESTAMP, ForeignKey
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()

# IMPORTANT: Table cannot be named "USER", which is a SQL keyword.
class User(Base):
    __tablename__ = 'user'
    
    user_id = Column(String(40), primary_key=True)
    name = Column(String(100), nullable=False)
    email = Column(String(200), nullable=False, unique=True)
    philanthropy_score = Column(Integer, nullable=False)
    socialimpact_score = Column(Integer, nullable=False)
    donation = Column(Integer)
    fairness_score = Column(Integer, nullable=False)
    composite_score = Column(Integer, nullable=False)
    affiliation = Column(String(200))
    strategy = Column(String(200), nullable=False)
    
    # This defines the relationship: a User can have many Bids
    bids = relationship("Bid", back_populates="user")

class Auction(Base):
    __tablename__ = 'AUCTION'
    
    auction_id = Column(String(40), primary_key=True)
    name = Column(String(10000), nullable=False)
    impact_area = Column(String(1000), nullable=False)
    description = Column(String(100000))
    min_donation = Column(Integer, nullable=False)
    starts_at = Column(TIMESTAMP, nullable=False)
    ends_at = Column(TIMESTAMP, nullable=False)
    status = Column(String(10))
    donation_weight = Column(Float, nullable=False)
    profile_weight = Column(Float, nullable=False)
    fairness_weight = Column(Float, nullable=False)
    
    # This defines the relationship: an Auction can have many Bids
    bids = relationship("Bid", back_populates="auction")

class Bid(Base):
    __tablename__ = 'BID'
    
    bid_id = Column(String(40), primary_key=True)
    created_at = Column(TIMESTAMP, nullable=False)
    bid_amount = Column(Integer, nullable=False)
    # Foreign Keys
    user_id = Column(String(40), ForeignKey('user.user_id'), nullable=False)
    auction_id = Column(String(40), ForeignKey('AUCTION.auction_id'), nullable=False)

    user = relationship("User", back_populates="bids", foreign_keys=[user_id])
    auction = relationship("Auction", back_populates="bids", foreign_keys=[auction_id])